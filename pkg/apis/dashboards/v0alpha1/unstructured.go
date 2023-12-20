package v0alpha1

import (
	"encoding/json"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	runtime "k8s.io/apimachinery/pkg/runtime"
)

// Unstructured allows objects that do not have Golang structs registered to be manipulated
// generically.
type Unstructured struct {
	// Object is a JSON compatible map with string, float, int, bool, []interface{}, or
	// map[string]interface{}
	// children.
	Object map[string]interface{}
}

func (obj *Unstructured) UnstructuredContent() map[string]interface{} {
	if obj.Object == nil {
		return make(map[string]interface{})
	}
	return obj.Object
}

func (obj *Unstructured) SetUnstructuredContent(content map[string]interface{}) {
	obj.Object = content
}

// MarshalJSON ensures that the unstructured object produces proper
// JSON when passed to Go's standard JSON library.
func (u *Unstructured) MarshalJSON() ([]byte, error) {
	return json.Marshal(u.Object)
}

// UnmarshalJSON ensures that the unstructured object properly decodes
// JSON when passed to Go's standard JSON library.
func (u *Unstructured) UnmarshalJSON(b []byte) error {
	return json.Unmarshal(b, &u.Object)
}

func (u *Unstructured) DeepCopy() *Unstructured {
	if u == nil {
		return nil
	}
	out := new(Unstructured)
	*out = *u
	out.Object = runtime.DeepCopyJSON(u.Object)
	return out
}

func (u *Unstructured) DeepCopyInto(out *Unstructured) {
	clone := u.DeepCopy()
	*out = *clone
}

func (u *Unstructured) Set(field string, value interface{}) {
	if u.Object == nil {
		u.Object = make(map[string]interface{})
	}
	unstructured.SetNestedField(u.Object, value, field)
}

func (u *Unstructured) Remove(fields ...string) {
	if u.Object == nil {
		u.Object = make(map[string]interface{})
	}
	unstructured.RemoveNestedField(u.Object, fields...)
}

func (u *Unstructured) SetNestedField(value interface{}, fields ...string) {
	if u.Object == nil {
		u.Object = make(map[string]interface{})
	}
	unstructured.SetNestedField(u.Object, value, fields...)
}

func (u *Unstructured) GetNestedString(fields ...string) string {
	val, found, err := unstructured.NestedString(u.Object, fields...)
	if !found || err != nil {
		return ""
	}
	return val
}

func (u *Unstructured) GetNestedStringSlice(fields ...string) []string {
	val, found, err := unstructured.NestedStringSlice(u.Object, fields...)
	if !found || err != nil {
		return nil
	}
	return val
}

func (u *Unstructured) GetNestedInt64(fields ...string) int64 {
	val, found, err := unstructured.NestedInt64(u.Object, fields...)
	if !found || err != nil {
		return 0
	}
	return val
}
