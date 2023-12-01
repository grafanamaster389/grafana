// Code generated by mockery v2.37.1. DO NOT EDIT.

package ssosettingstests

import (
	context "context"

	identity "github.com/grafana/grafana/pkg/services/auth/identity"
	mock "github.com/stretchr/testify/mock"

	models "github.com/grafana/grafana/pkg/services/ssosettings/models"

	ssosettings "github.com/grafana/grafana/pkg/services/ssosettings"
)

// MockService is an autogenerated mock type for the Service type
type MockService struct {
	mock.Mock
}

// Delete provides a mock function with given fields: ctx, provider
func (_m *MockService) Delete(ctx context.Context, provider string) error {
	ret := _m.Called(ctx, provider)

	var r0 error
	if rf, ok := ret.Get(0).(func(context.Context, string) error); ok {
		r0 = rf(ctx, provider)
	} else {
		r0 = ret.Error(0)
	}

	return r0
}

// GetForProvider provides a mock function with given fields: ctx, provider
func (_m *MockService) GetForProvider(ctx context.Context, provider string) (*models.SSOSettings, error) {
	ret := _m.Called(ctx, provider)

	var r0 *models.SSOSettings
	var r1 error
	if rf, ok := ret.Get(0).(func(context.Context, string) (*models.SSOSettings, error)); ok {
		return rf(ctx, provider)
	}
	if rf, ok := ret.Get(0).(func(context.Context, string) *models.SSOSettings); ok {
		r0 = rf(ctx, provider)
	} else {
		if ret.Get(0) != nil {
			r0 = ret.Get(0).(*models.SSOSettings)
		}
	}

	if rf, ok := ret.Get(1).(func(context.Context, string) error); ok {
		r1 = rf(ctx, provider)
	} else {
		r1 = ret.Error(1)
	}

	return r0, r1
}

// List provides a mock function with given fields: ctx, requester
func (_m *MockService) List(ctx context.Context, requester identity.Requester) ([]*models.SSOSettings, error) {
	ret := _m.Called(ctx, requester)

	var r0 []*models.SSOSettings
	var r1 error
	if rf, ok := ret.Get(0).(func(context.Context, identity.Requester) ([]*models.SSOSettings, error)); ok {
		return rf(ctx, requester)
	}
	if rf, ok := ret.Get(0).(func(context.Context, identity.Requester) []*models.SSOSettings); ok {
		r0 = rf(ctx, requester)
	} else {
		if ret.Get(0) != nil {
			r0 = ret.Get(0).([]*models.SSOSettings)
		}
	}

	if rf, ok := ret.Get(1).(func(context.Context, identity.Requester) error); ok {
		r1 = rf(ctx, requester)
	} else {
		r1 = ret.Error(1)
	}

	return r0, r1
}

// Patch provides a mock function with given fields: ctx, provider, data
func (_m *MockService) Patch(ctx context.Context, provider string, data map[string]interface{}) error {
	ret := _m.Called(ctx, provider, data)

	var r0 error
	if rf, ok := ret.Get(0).(func(context.Context, string, map[string]interface{}) error); ok {
		r0 = rf(ctx, provider, data)
	} else {
		r0 = ret.Error(0)
	}

	return r0
}

// RegisterReloadable provides a mock function with given fields: ctx, provider, reloadable
func (_m *MockService) RegisterReloadable(ctx context.Context, provider string, reloadable ssosettings.Reloadable) {
	_m.Called(ctx, provider, reloadable)
}

// Reload provides a mock function with given fields: ctx, provider
func (_m *MockService) Reload(ctx context.Context, provider string) {
	_m.Called(ctx, provider)
}

// Upsert provides a mock function with given fields: ctx, settings
func (_m *MockService) Upsert(ctx context.Context, settings models.SSOSettings) error {
	ret := _m.Called(ctx, settings)

	var r0 error
	if rf, ok := ret.Get(0).(func(context.Context, models.SSOSettings) error); ok {
		r0 = rf(ctx, settings)
	} else {
		r0 = ret.Error(0)
	}

	return r0
}

// NewMockService creates a new instance of MockService. It also registers a testing interface on the mock and a cleanup function to assert the mocks expectations.
// The first argument is typically a *testing.T value.
func NewMockService(t interface {
	mock.TestingT
	Cleanup(func())
}) *MockService {
	mock := &MockService{}
	mock.Mock.Test(t)

	t.Cleanup(func() { mock.AssertExpectations(t) })

	return mock
}
