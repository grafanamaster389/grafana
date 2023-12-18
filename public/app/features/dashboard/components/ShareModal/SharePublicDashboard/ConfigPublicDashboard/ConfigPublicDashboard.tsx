import { css } from '@emotion/css';
import React from 'react';
import { useForm } from 'react-hook-form';

import { GrafanaTheme2, TimeRange } from '@grafana/data/src';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { config, featureEnabled } from '@grafana/runtime/src';
import {
  Button,
  ClipboardButton,
  Field,
  HorizontalGroup,
  Input,
  Label,
  ModalsController,
  Switch,
  useStyles2,
} from '@grafana/ui/src';
import { Layout } from '@grafana/ui/src/components/Layout/Layout';
import { Trans, t } from 'app/core/internationalization';
import {
  useDeletePublicDashboardMutation,
  useUpdatePublicDashboardMutation,
} from 'app/features/dashboard/api/publicDashboardApi';
import { DashboardModel } from 'app/features/dashboard/state';
import { getTimeRange } from 'app/features/dashboard/utils/timeRange';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { DeletePublicDashboardModal } from 'app/features/manage-dashboards/components/PublicDashboardListTable/DeletePublicDashboardModal';

import { contextSrv } from '../../../../../../core/services/context_srv';
import { AccessControlAction, useSelector } from '../../../../../../types';
import { useIsDesktop } from '../../../../utils/screen';
import { ShareModal } from '../../ShareModal';
import { shareDashboardType } from '../../utils';
import { NoUpsertPermissionsAlert } from '../ModalAlerts/NoUpsertPermissionsAlert';
import { SaveDashboardChangesAlert } from '../ModalAlerts/SaveDashboardChangesAlert';
import { UnsupportedDataSourcesAlert } from '../ModalAlerts/UnsupportedDataSourcesAlert';
import { UnsupportedTemplateVariablesAlert } from '../ModalAlerts/UnsupportedTemplateVariablesAlert';
import {
  dashboardHasTemplateVariables,
  generatePublicDashboardUrl,
  PublicDashboard,
} from '../SharePublicDashboardUtils';

import { Configuration } from './Configuration';
import { EmailSharingConfiguration } from './EmailSharingConfiguration';
import { SettingsBar } from './SettingsBar';
import { SettingsSummary } from './SettingsSummary';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

export interface ConfigPublicDashboardForm {
  isAnnotationsEnabled: boolean;
  isTimeSelectionEnabled: boolean;
  isPaused: boolean;
}

interface Props {
  unsupportedDatasources?: string[];
  showSaveChangesAlert?: boolean;
  publicDashboard?: PublicDashboard;
  hasTemplateVariables?: boolean;
  timeRange: TimeRange;
  onRevoke: () => void;
  dashboard: DashboardModel | DashboardScene;
}

export function ConfigPublicDashboardBase({
  onRevoke,
  timeRange,
  hasTemplateVariables = false,
  showSaveChangesAlert = false,
  unsupportedDatasources = [],
  publicDashboard,
  dashboard,
}: Props) {
  const styles = useStyles2(getStyles);
  const isDesktop = useIsDesktop();

  const [update, { isLoading }] = useUpdatePublicDashboardMutation();
  const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);
  const disableInputs = !hasWritePermissions || isLoading;
  const hasEmailSharingEnabled =
    !!config.featureToggles.publicDashboardsEmailSharing && featureEnabled('publicDashboardsEmailSharing');

  const { handleSubmit, setValue, register } = useForm<ConfigPublicDashboardForm>({
    defaultValues: {
      isAnnotationsEnabled: publicDashboard?.annotationsEnabled,
      isTimeSelectionEnabled: publicDashboard?.timeSelectionEnabled,
      isPaused: !publicDashboard?.isEnabled,
    },
  });

  const onPublicDashboardUpdate = async (values: ConfigPublicDashboardForm) => {
    const { isAnnotationsEnabled, isTimeSelectionEnabled, isPaused } = values;

    update({
      dashboard: dashboard,
      payload: {
        ...publicDashboard!,
        annotationsEnabled: isAnnotationsEnabled,
        timeSelectionEnabled: isTimeSelectionEnabled,
        isEnabled: !isPaused,
      },
    });
  };

  const onChange = async (name: keyof ConfigPublicDashboardForm, value: boolean) => {
    setValue(name, value);
    await handleSubmit((data) => onPublicDashboardUpdate(data))();
  };

  function onCopyURL() {
    DashboardInteractions.publicDashboardUrlCopied();
  }

  return (
    <div className={styles.configContainer}>
      {showSaveChangesAlert && <SaveDashboardChangesAlert />}
      {!hasWritePermissions && <NoUpsertPermissionsAlert mode="edit" />}
      {hasTemplateVariables && <UnsupportedTemplateVariablesAlert />}
      {unsupportedDatasources.length > 0 && (
        <UnsupportedDataSourcesAlert unsupportedDataSources={unsupportedDatasources.join(', ')} />
      )}

      {hasEmailSharingEnabled && <EmailSharingConfiguration />}

      <Field
        label={t('config-public-dashboard.public-dashboard.field-label', 'Dashboard URL')}
        className={styles.fieldSpace}
      >
        <Input
          value={generatePublicDashboardUrl(publicDashboard!.accessToken!)}
          readOnly
          disabled={!publicDashboard?.isEnabled}
          data-testid={selectors.CopyUrlInput}
          addonAfter={
            <ClipboardButton
              data-testid={selectors.CopyUrlButton}
              variant="primary"
              disabled={!publicDashboard?.isEnabled}
              getText={() => generatePublicDashboardUrl(publicDashboard!.accessToken!)}
              onClipboardCopy={onCopyURL}
            >
              Copy
            </ClipboardButton>
          }
        />
      </Field>

      <Field className={styles.fieldSpace}>
        <Layout>
          <Switch
            {...register('isPaused')}
            disabled={disableInputs}
            onChange={(e) => {
              DashboardInteractions.publicDashboardPauseSharingClicked({
                paused: e.currentTarget.checked,
              });
              onChange('isPaused', e.currentTarget.checked);
            }}
            data-testid={selectors.PauseSwitch}
          />
          <Label
            className={css`
              margin-bottom: 0;
            `}
          >
            <Trans i18nKey="config-public-dashboard.public-dashboard.pause-sharing-dashboard">
              Pause sharing dashboard
            </Trans>
          </Label>
        </Layout>
      </Field>

      <Field className={styles.fieldSpace}>
        <SettingsBar
          title={t('config-public-dashboard.public-dashboard.settings-title', 'Settings')}
          headerElement={({ className }) => (
            <SettingsSummary
              className={className}
              isDataLoading={isLoading}
              timeRange={timeRange}
              timeSelectionEnabled={publicDashboard?.timeSelectionEnabled}
              annotationsEnabled={publicDashboard?.annotationsEnabled}
            />
          )}
          data-testid={selectors.SettingsDropdown}
        >
          <Configuration disabled={disableInputs} onChange={onChange} register={register} timeRange={timeRange} />
        </SettingsBar>
      </Field>

      <Layout
        orientation={isDesktop ? 0 : 1}
        justify={isDesktop ? 'flex-end' : 'flex-start'}
        align={isDesktop ? 'center' : 'normal'}
      >
        <HorizontalGroup justify="flex-end">
          <Button
            aria-label="Revoke public URL"
            title="Revoke public URL"
            onClick={onRevoke}
            type="button"
            disabled={disableInputs}
            data-testid={selectors.DeleteButton}
            variant="destructive"
            fill="outline"
          >
            <Trans i18nKey="config-public-dashboard.public-dashboard.revoke-public-URL">Revoke public URL</Trans>
          </Button>
        </HorizontalGroup>
      </Layout>
    </div>
  );
}

interface ConfigPublicDashboardProps {
  publicDashboard: PublicDashboard;
  unsupportedDatasources: string[];
}

export function ConfigPublicDashboard({ publicDashboard, unsupportedDatasources }: ConfigPublicDashboardProps) {
  const dashboardState = useSelector((store) => store.dashboard);
  const dashboard = dashboardState.getModel()!;
  const timeRange = getTimeRange(dashboard.getDefaultTime(), dashboard);
  const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);
  const hasTemplateVariables = dashboardHasTemplateVariables(dashboard.getVariables());
  const [deletePublicDashboard] = useDeletePublicDashboardMutation();
  const onDeletePublicDashboardClick = (onDelete: () => void) => {
    deletePublicDashboard({
      dashboard,
      uid: publicDashboard!.uid,
      dashboardUid: dashboard.uid,
    });
    onDelete();
  };

  return (
    <ModalsController>
      {({ showModal, hideModal }) => (
        <ConfigPublicDashboardBase
          publicDashboard={publicDashboard}
          dashboard={dashboard}
          unsupportedDatasources={unsupportedDatasources}
          timeRange={timeRange}
          showSaveChangesAlert={hasWritePermissions && dashboard.hasUnsavedChanges()}
          hasTemplateVariables={hasTemplateVariables}
          onRevoke={() => {
            DashboardInteractions.revokePublicDashboardClicked();
            showModal(DeletePublicDashboardModal, {
              dashboardTitle: dashboard.title,
              onConfirm: () => onDeletePublicDashboardClick(hideModal),
              onDismiss: () => {
                showModal(ShareModal, {
                  dashboard,
                  onDismiss: hideModal,
                  activeTab: shareDashboardType.publicDashboard,
                });
              },
            });
          }}
        />
      )}
    </ModalsController>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  configContainer: css`
    label: config container;
    display: flex;
    flex-direction: column;
    flex-wrap: wrap;
    gap: ${theme.spacing(3)};
  `,
  fieldSpace: css`
    label: field space;
    width: 100%;
    margin-bottom: 0;
  `,
  timeRange: css({
    display: 'inline-block',
  }),
});
