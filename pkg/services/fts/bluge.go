package fts

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"

	"github.com/blugelabs/bluge"
)

// Composition: AND / OR
type blugeSearcher struct {
	w *bluge.Writer
}

func NewBlugeInMemorySearch() (Search, error) {
	config := bluge.InMemoryOnlyConfig()
	w, err := bluge.OpenWriter(config)
	if err != nil {
		return nil, err
	}
	return &blugeSearcher{w: w}, nil
}

type id Ref

func (id id) String() string {
	return fmt.Sprintf("%s:%d:%s", id.Kind, id.OrgID, id.UID)
}

func parseID(s string) (id, error) {
	parts := strings.SplitN(s, ":", 3)
	if len(parts) != 3 {
		return id{}, errors.New("bad format")
	}
	orgID, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return id{}, err
	}
	return id{Kind: parts[0], OrgID: orgID, UID: parts[2]}, nil
}

func (bs *blugeSearcher) Add(_ context.Context, fields ...Field) error {
	batch := bluge.NewBatch()
	for _, f := range fields {
		// TODO: support weight?
		doc := bluge.NewDocument(id(f.Ref).String()).AddField(bluge.NewTextField("text", f.Text))
		batch.Update(doc.ID(), doc)
	}
	return bs.w.Batch(batch)
}

func (bs *blugeSearcher) Delete(_ context.Context, ref Ref) error {
	return bs.w.Delete(bluge.NewDocument(id(ref).String()).ID())
}

func (bs *blugeSearcher) Search(_ context.Context, query string) ([]Ref, error) {
	r, err := bs.w.Reader()
	if err != nil {
		return nil, err
	}
	defer r.Close()

	q := bluge.NewBooleanQuery()
	for _, s := range splitFields(query) {
		if strings.HasPrefix(s, "+") {
			q.AddMust(bluge.NewMatchQuery(s[1:]).SetField("text"))
		} else if strings.HasPrefix(s, "-") {
			q.AddMustNot(bluge.NewMatchQuery(s[1:]).SetField("text"))
		} else if strings.HasPrefix(s, `"`) && strings.HasSuffix(s, `"`) {
			q.AddShould(bluge.NewMatchPhraseQuery(s).SetField("text").SetSlop(1))
		} else if strings.HasSuffix(s, `*`) {
			q.AddShould(bluge.NewPrefixQuery(s[:len(s)-1]).SetField("text"))
		} else {
			q.AddShould(bluge.NewMatchQuery(s).SetField("text"))
		}
	}
	// q := bluge.NewPrefixQuery(query).SetField("text")
	request := bluge.NewTopNSearch(50, q)
	documentMatchIterator, err := r.Search(context.Background(), request)
	if err != nil {
		return nil, err
	}
	match, err := documentMatchIterator.Next()
	results := []Ref{}
	for err == nil && match != nil {
		err = match.VisitStoredFields(func(field string, value []byte) bool {
			if field == "_id" {
				id, err := parseID(string(value))
				if err == nil {
					results = append(results, Ref{
						OrgID: id.OrgID,
						Kind:  id.Kind,
						UID:   id.UID,
					})
				} else {
					log.Fatal(err)
				}
			}
			return true
		})
		if err != nil {
			return nil, err
		}
		match, err = documentMatchIterator.Next()
	}
	if err != nil {
		return nil, err
	}

	return results, nil
}

func (bs *blugeSearcher) Close() error {
	return bs.w.Close()
}

func splitFields(s string) []string {
	quoted := false
	return strings.FieldsFunc(s, func(r rune) bool {
		if r == '"' {
			quoted = !quoted
		}
		return !quoted && r == ' '
	})
}
