import { waitFor, within } from '@testing-library/dom';
import { render, screen } from '@testing-library/react';
import { createMemoryHistory } from 'history';
import { fromPairs } from 'lodash';
import { stringify } from 'querystring';
import React from 'react';
import { Provider } from 'react-redux';
import { Route, Router } from 'react-router-dom';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import {
  DataSourceApi,
  DataSourceInstanceSettings,
  QueryEditorProps,
  DataSourcePluginMeta,
  PluginType,
} from '@grafana/data';
import {
  setDataSourceSrv,
  setEchoSrv,
  setLocationService,
  HistoryWrapper,
  LocationService,
  setPluginExtensionGetter,
} from '@grafana/runtime';
import { DataSourceRef } from '@grafana/schema';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { GrafanaRoute } from 'app/core/navigation/GrafanaRoute';
import { Echo } from 'app/core/services/echo/Echo';
import { setLastUsedDatasourceUID } from 'app/features/explore/utils';

import { LokiDatasource } from '../../../../plugins/datasource/loki/datasource';
import { LokiQuery } from '../../../../plugins/datasource/loki/types';
import ExplorePage from '../../ExplorePage';
import { exploreReducer, initialExploreState } from '../../state/main';
import { configureExploreStore } from '../../state/store';
import { ExploreQueryParams } from '../../types';

type DatasourceSetup = { settings: DataSourceInstanceSettings; api: DataSourceApi };

type SetupOptions = {
  clearLocalStorage?: boolean;
  datasources?: DatasourceSetup[];
  urlParams?: ExploreQueryParams;
  prevUsedDatasource?: { orgId: number; datasource: string };
};

export function setupExplore(options?: SetupOptions): {
  datasources: { [uid: string]: DataSourceApi };
  store: ReturnType<typeof configureExploreStore>;
  unmount: () => void;
  container: HTMLElement;
  location: LocationService;
} {
  setPluginExtensionGetter(() => ({ extensions: [] }));

  // Clear this up otherwise it persists data source selection
  // TODO: probably add test for that too
  if (options?.clearLocalStorage !== false) {
    window.localStorage.clear();
  }

  if (options?.prevUsedDatasource) {
    setLastUsedDatasourceUID(options?.prevUsedDatasource.orgId, options?.prevUsedDatasource.datasource);
  }

  // Create this here so any mocks are recreated on setup and don't retain state
  const defaultDatasources: DatasourceSetup[] = [
    makeDatasourceSetup(),
    makeDatasourceSetup({ name: 'elastic', id: 2 }),
    makeDatasourceSetup({ name: '-- Mixed --', uid: '-- Mixed --', id: 999 }),
  ];

  const dsSettings = options?.datasources || defaultDatasources;

  setDataSourceSrv({
    getList(): DataSourceInstanceSettings[] {
      return dsSettings.map((d) => d.settings);
    },
    getInstanceSettings(ref?: DataSourceRef) {
      const allSettings = dsSettings.map((d) => d.settings);
      return allSettings.find((x) => x.name === ref || x.uid === ref || x.uid === ref?.uid) || allSettings[0];
    },
    get(datasource?: string | DataSourceRef | null): Promise<DataSourceApi> {
      let ds: DataSourceApi | undefined;
      if (!datasource) {
        ds = dsSettings[0]?.api;
      } else {
        ds = dsSettings.find((ds) =>
          typeof datasource === 'string'
            ? ds.api.name === datasource || ds.api.uid === datasource
            : ds.api.uid === datasource?.uid
        )?.api;
      }

      if (ds) {
        return Promise.resolve(ds);
      }

      return Promise.reject();
    },
    reload() {},
  });

  setEchoSrv(new Echo());

  const exploreStore = configureExploreStore(exploreReducer, initialExploreState);

  const history = createMemoryHistory({
    initialEntries: [{ pathname: '/explore', search: stringify(options?.urlParams) }],
  });

  const location = new HistoryWrapper(history);
  setLocationService(location);

  const contextMock = getGrafanaContextMock({ location });

  // @ts-ignore
  const { unmount, container } = render(
    <Provider store={exploreStore}>
      <GrafanaContext.Provider value={contextMock}>
        <Router history={history}>
          <Route
            path="/explore"
            exact
            // @ts-ignore
            render={(props) => <GrafanaRoute {...props} route={{ component: ExplorePage, path: '/explore' }} />}
          />
        </Router>
      </GrafanaContext.Provider>
    </Provider>
  );

  return {
    datasources: fromPairs(dsSettings.map((d) => [d.api.name, d.api])),
    store: exploreStore,
    unmount,
    container,
    location,
  };
}

export function makeDatasourceSetup({
  name = 'loki',
  id = 1,
  uid: uidOverride,
}: { name?: string; id?: number; uid?: string } = {}): DatasourceSetup {
  const uid = uidOverride || `${name}-uid`;
  const type = 'logs';

  const meta: DataSourcePluginMeta = {
    info: {
      author: {
        name: 'Grafana',
      },
      description: '',
      links: [],
      screenshots: [],
      updated: '',
      version: '',
      logos: {
        small: '',
        large: '',
      },
    },
    id: id.toString(),
    module: 'loki',
    name,
    type: PluginType.datasource,
    baseUrl: '',
  };
  return {
    settings: {
      id,
      uid,
      type,
      name,
      meta,
      access: 'proxy',
      jsonData: {},
      readOnly: false,
    },
    api: {
      components: {
        QueryEditor(props: QueryEditorProps<LokiDatasource, LokiQuery>) {
          return (
            <div>
              <input
                aria-label="query"
                defaultValue={props.query.expr}
                onChange={(event) => {
                  props.onChange({ ...props.query, expr: event.target.value });
                }}
              />
              {name} Editor input: {props.query.expr}
            </div>
          );
        },
      },
      name: name,
      uid: uid,
      query: jest.fn(),
      getRef: () => ({ type, uid }),
      meta,
    } as any,
  };
}

export const waitForExplore = (exploreId = 'left') => {
  return waitFor(async () => {
    const container = screen.getAllByTestId('data-testid Explore');
    return within(container[exploreId === 'left' ? 0 : 1]);
  });
};

export const tearDown = () => {
  window.localStorage.clear();
};

export const withinExplore = (exploreId: string) => {
  const container = screen.getAllByTestId('data-testid Explore');
  return within(container[exploreId === 'left' ? 0 : 1]);
};
