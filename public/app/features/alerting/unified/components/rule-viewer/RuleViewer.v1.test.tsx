import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { byRole, byText } from 'testing-library-selector';

import { PluginExtensionTypes } from '@grafana/data';
import { getPluginLinkExtensions, locationService, setBackendSrv } from '@grafana/runtime';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';
import { CombinedRule } from 'app/types/unified-alerting';
import { PromAlertingRuleState, PromApplication } from 'app/types/unified-alerting-dto';

import { discoverFeatures } from '../../api/buildInfo';
import { AlertRuleAction, useAlertRuleAbility } from '../../hooks/useAbilities';
import { mockAlertRuleApi, setupMswServer } from '../../mockApi';
import {
  getCloudRule,
  getGrafanaRule,
  grantUserPermissions,
  mockDataSource,
  mockPromAlertingRule,
  mockRulerAlertingRule,
  promRuleFromRulerRule,
} from '../../mocks';
import { mockAlertmanagerChoiceResponse } from '../../mocks/alertmanagerApi';
import { mockPluginSettings } from '../../mocks/plugins';
import { setupDataSources } from '../../testSetup/datasources';
import { SupportedPlugin } from '../../types/pluginBridges';
import * as ruleId from '../../utils/rule-id';

import { RuleViewer } from './RuleViewer.v1';

const mockGrafanaRule = getGrafanaRule({ name: 'Test alert' }, { uid: 'test1', title: 'Test alert' });
const mockCloudRule = getCloudRule({ name: 'cloud test alert' });

const mockRoute = (id?: string): GrafanaRouteComponentProps<{ id?: string; sourceName?: string }> => ({
  route: {
    path: '/',
    component: RuleViewer,
  },
  queryParams: { returnTo: '/alerting/list' },
  match: { params: { id: id ?? 'test1', sourceName: 'grafana' }, isExact: false, url: 'asdf', path: '' },
  history: locationService.getHistory(),
  location: { pathname: '', hash: '', search: '', state: '' },
  staticContext: {},
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getPluginLinkExtensions: jest.fn(),
}));
jest.mock('../../hooks/useAbilities');
jest.mock('../../api/buildInfo');

const mocks = {
  getPluginLinkExtensionsMock: jest.mocked(getPluginLinkExtensions),
  useAlertRuleAbility: jest.mocked(useAlertRuleAbility),
};

const ui = {
  actionButtons: {
    edit: byRole('link', { name: /edit/i }),
    silence: byText(/silence/i),
  },
  moreButton: byRole('button', { name: /More/i }),
  moreButtons: {
    duplicate: byRole('menuitem', { name: /^Duplicate$/i }),
    delete: byRole('menuitem', { name: /delete/i }),
  },
  loadingIndicator: byText(/Loading rule/i),
};

const renderRuleViewer = async (ruleId: string) => {
  locationService.push(`/alerting/grafana/${ruleId}/view`);
  render(
    <TestProvider>
      <RuleViewer {...mockRoute(ruleId)} />
    </TestProvider>
  );

  await waitFor(() => expect(ui.loadingIndicator.query()).not.toBeInTheDocument());
};

const server = setupMswServer();
const user = userEvent.setup();

const dsName = 'prometheus';
const rulerRule = mockRulerAlertingRule({ alert: 'cloud test alert' });
const rulerRuleIdentifier = ruleId.fromRulerRule('prometheus', 'ns-default', 'group-default', rulerRule);

beforeAll(() => {
  setBackendSrv(backendSrv);
  const promDsSettings = mockDataSource({
    name: dsName,
    uid: dsName,
  });

  setupDataSources(promDsSettings);
});

beforeEach(() => {
  // some action buttons need to check what Alertmanager setup we have for Grafana managed rules
  mockAlertmanagerChoiceResponse(server, {
    alertmanagersChoice: AlertmanagerChoice.Internal,
    numExternalAlertmanagers: 1,
  });
  // we need to mock this one for the "declare incident" button
  mockPluginSettings(server, SupportedPlugin.Incident);

  mockAlertRuleApi(server).rulerRules('grafana', {
    [mockGrafanaRule.namespace.name]: [
      { name: mockGrafanaRule.group.name, interval: '1m', rules: [mockGrafanaRule.rulerRule!] },
    ],
  });

  const { name, query, labels, annotations } = mockGrafanaRule;
  mockAlertRuleApi(server).prometheusRuleNamespaces('grafana', {
    data: {
      groups: [
        {
          file: mockGrafanaRule.namespace.name,
          interval: 60,
          name: mockGrafanaRule.group.name,
          rules: [mockPromAlertingRule({ name, query, labels, annotations })],
        },
      ],
    },
    status: 'success',
  });

  mockAlertRuleApi(server).rulerRuleGroup(dsName, 'ns-default', 'group-default', {
    name: 'group-default',
    interval: '1m',
    rules: [rulerRule],
  });

  mockAlertRuleApi(server).prometheusRuleNamespaces(dsName, {
    data: {
      groups: [
        {
          file: 'ns-default',
          interval: 60,
          name: 'group-default',
          rules: [promRuleFromRulerRule(rulerRule, { state: PromAlertingRuleState.Inactive })],
        },
      ],
    },
    status: 'success',
  });
  mocks.getPluginLinkExtensionsMock.mockReturnValue({
    extensions: [
      {
        pluginId: 'grafana-ml-app',
        id: '1',
        type: PluginExtensionTypes.link,
        title: 'Run investigation',
        category: 'Sift',
        description: 'Run a Sift investigation for this alert',
        onClick: jest.fn(),
      },
    ],
  });
});

describe('RuleViewer', () => {
  let mockCombinedRule = jest.fn();

  afterEach(() => {
    mockCombinedRule.mockReset();
  });

  it('should render page with grafana alert', async () => {
    mocks.useAlertRuleAbility.mockReturnValue([true, true]);
    await renderRuleViewer('test1');

    expect(screen.getByText(/test alert/i)).toBeInTheDocument();
  });

  it('should render page with cloud alert', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

    jest
      .mocked(discoverFeatures)
      .mockResolvedValue({ application: PromApplication.Mimir, features: { rulerApiEnabled: true } });

    mocks.useAlertRuleAbility.mockReturnValue([true, true]);
    await renderRuleViewer(ruleId.stringifyIdentifier(rulerRuleIdentifier));

    expect(screen.getByText(/cloud test alert/i)).toBeInTheDocument();
  });
});

describe('RuleDetails RBAC', () => {
  describe('Grafana rules action buttons in details', () => {
    let mockCombinedRule = jest.fn();

    beforeEach(() => {
      // mockCombinedRule = jest.mocked(useCombinedRule);
    });

    afterEach(() => {
      mockCombinedRule.mockReset();
    });
    it('Should render Edit button for users with the update permission', async () => {
      // Arrange
      mocks.useAlertRuleAbility.mockImplementation((_rule, action) => {
        return action === AlertRuleAction.Update ? [true, true] : [false, false];
      });
      mockCombinedRule.mockReturnValue({
        result: mockGrafanaRule as CombinedRule,
        loading: false,
        dispatched: true,
        requestId: 'A',
        error: undefined,
      });

      // Act
      await renderRuleViewer('test1');

      // Assert
      expect(ui.actionButtons.edit.get()).toBeInTheDocument();
    });

    it('Should render Delete button for users with the delete permission', async () => {
      // Arrange
      mockCombinedRule.mockReturnValue({
        result: mockGrafanaRule as CombinedRule,
        loading: false,
        dispatched: true,
        requestId: 'A',
        error: undefined,
      });
      mocks.useAlertRuleAbility.mockImplementation((_rule, action) => {
        return action === AlertRuleAction.Delete ? [true, true] : [false, false];
      });

      // Act
      await renderRuleViewer('test1');
      await user.click(ui.moreButton.get());

      // Assert
      expect(ui.moreButtons.delete.get()).toBeInTheDocument();
    });

    it('Should not render Silence button for users wihout the instance create permission', async () => {
      // Arrange
      mockCombinedRule.mockReturnValue({
        result: mockGrafanaRule as CombinedRule,
        loading: false,
        dispatched: true,
        requestId: 'A',
        error: undefined,
      });
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

      // Act
      await renderRuleViewer('test1');

      // Assert
      await waitFor(() => {
        expect(ui.actionButtons.silence.query()).not.toBeInTheDocument();
      });
    });

    it('Should render Silence button for users with the instance create permissions', async () => {
      // Arrange
      mocks.useAlertRuleAbility.mockReturnValue([true, true]);
      mockCombinedRule.mockReturnValue({
        result: mockGrafanaRule as CombinedRule,
        loading: false,
        dispatched: true,
        requestId: 'A',
        error: undefined,
      });
      jest
        .spyOn(contextSrv, 'hasPermission')
        .mockImplementation((action) => action === AccessControlAction.AlertingInstanceCreate);

      // Act
      await renderRuleViewer('test1');

      // Assert
      await waitFor(() => {
        expect(ui.actionButtons.silence.get()).toBeInTheDocument();
      });
    });

    it('Should render clone button for users having create rule permission', async () => {
      mocks.useAlertRuleAbility.mockImplementation((_rule, action) => {
        return action === AlertRuleAction.Duplicate ? [true, true] : [false, false];
      });
      mockCombinedRule.mockReturnValue({
        result: getGrafanaRule({ name: 'Grafana rule' }),
        loading: false,
        dispatched: true,
      });
      grantUserPermissions([AccessControlAction.AlertingRuleCreate]);

      await renderRuleViewer('test1');
      await user.click(ui.moreButton.get());

      expect(ui.moreButtons.duplicate.get()).toBeInTheDocument();
    });

    it('Should NOT render clone button for users without create rule permission', async () => {
      mocks.useAlertRuleAbility.mockImplementation((_rule, action) => {
        return action === AlertRuleAction.Duplicate ? [true, false] : [true, true];
      });
      mockCombinedRule.mockReturnValue({
        result: getGrafanaRule({ name: 'Grafana rule' }),
        loading: false,
        dispatched: true,
      });

      const { AlertingRuleRead, AlertingRuleUpdate, AlertingRuleDelete } = AccessControlAction;
      grantUserPermissions([AlertingRuleRead, AlertingRuleUpdate, AlertingRuleDelete]);

      await renderRuleViewer('test1');
      await user.click(ui.moreButton.get());

      expect(ui.moreButtons.duplicate.query()).not.toBeInTheDocument();
    });
  });

  describe('Cloud rules action buttons', () => {
    const mockCombinedRule = jest.fn();

    afterEach(() => {
      mockCombinedRule.mockReset();
    });

    it('Should render edit button for users with the update permission', async () => {
      // Arrange
      mocks.useAlertRuleAbility.mockImplementation((_rule, action) => {
        return action === AlertRuleAction.Update ? [true, true] : [false, false];
      });
      mockCombinedRule.mockReturnValue({
        result: mockCloudRule as CombinedRule,
        loading: false,
        dispatched: true,
        requestId: 'A',
        error: undefined,
      });

      // Act
      await renderRuleViewer('test1');

      // Assert
      expect(ui.actionButtons.edit.query()).toBeInTheDocument();
    });

    it('Should render Delete button for users with the delete permission', async () => {
      // Arrange
      mocks.useAlertRuleAbility.mockImplementation((_rule, action) => {
        return action === AlertRuleAction.Delete ? [true, true] : [false, false];
      });
      mockCombinedRule.mockReturnValue({
        result: mockCloudRule as CombinedRule,
        loading: false,
        dispatched: true,
        requestId: 'A',
        error: undefined,
      });

      // Act
      await renderRuleViewer('test1');
      await user.click(ui.moreButton.get());

      // Assert
      expect(ui.moreButtons.delete.query()).toBeInTheDocument();
    });
  });
});
