import { isEmpty } from 'lodash';
import React from 'react';
import { catchError, map, Observable, of } from 'rxjs';

import {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  dateTimeFormat,
  FieldType,
  rangeUtil,
  ScopedVars,
} from '@grafana/data';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { store } from 'app/store/store';

import { ThrottlingErrorMessage } from '../components/Errors/ThrottlingErrorMessage';
import { migrateMetricQuery } from '../migrations/metricQueryMigrations';
import { CloudWatchJsonData, CloudWatchMetricsQuery, CloudWatchQuery } from '../types';
import { filterMetricsQuery } from '../utils/utils';

import { CloudWatchRequest } from './CloudWatchRequest';

// This class handles execution of CloudWatch metrics query data queries
export class CloudWatchMetricsQueryRunner extends CloudWatchRequest {
  constructor(instanceSettings: DataSourceInstanceSettings<CloudWatchJsonData>, templateSrv: TemplateSrv) {
    super(instanceSettings, templateSrv);
  }

  handleMetricQueries = (
    metricQueries: CloudWatchMetricsQuery[],
    options: DataQueryRequest<CloudWatchQuery>,
    queryFn: (request: DataQueryRequest<CloudWatchQuery>) => Observable<DataQueryResponse>
  ): Observable<DataQueryResponse> => {
    const timezoneUTCOffset = dateTimeFormat(Date.now(), {
      timeZone: options.timezone,
      format: 'Z',
    }).replace(':', '');

    const validMetricsQueries = metricQueries.filter(this.filterMetricQuery).map((q) => {
      const migratedQuery = migrateMetricQuery(q);
      const migratedAndIterpolatedQuery = this.replaceMetricQueryVars(migratedQuery, options.scopedVars);

      return {
        timezoneUTCOffset,
        intervalMs: options.intervalMs,
        maxDataPoints: options.maxDataPoints,
        ...migratedAndIterpolatedQuery,
        type: 'timeSeriesQuery',
        datasource: this.ref,
      };
    });

    // No valid targets, return the empty result to save a round trip.
    if (isEmpty(validMetricsQueries)) {
      return of({ data: [] });
    }

    const request: DataQueryRequest<CloudWatchQuery> = {
      ...options,
      targets: validMetricsQueries,
    };

    return this.performTimeSeriesQuery(request, queryFn);
  };

  interpolateMetricsQueryVariables(
    query: CloudWatchMetricsQuery,
    scopedVars: ScopedVars
  ): Pick<
    CloudWatchMetricsQuery,
    'alias' | 'metricName' | 'namespace' | 'period' | 'dimensions' | 'sqlExpression' | 'expression'
  > {
    return {
      alias: this.replaceVariableAndDisplayWarningIfMulti(query.alias, scopedVars),
      metricName: this.replaceVariableAndDisplayWarningIfMulti(query.metricName, scopedVars),
      namespace: this.replaceVariableAndDisplayWarningIfMulti(query.namespace, scopedVars),
      period: this.replaceVariableAndDisplayWarningIfMulti(query.period, scopedVars),
      expression: this.templateSrv.replace(query.expression, scopedVars),
      sqlExpression: this.replaceVariableAndDisplayWarningIfMulti(query.sqlExpression, scopedVars),
      dimensions: this.convertDimensionFormat(query.dimensions ?? {}, scopedVars),
    };
  }

  performTimeSeriesQuery(
    request: DataQueryRequest<CloudWatchQuery>,
    queryFn: (request: DataQueryRequest<CloudWatchQuery>) => Observable<DataQueryResponse>
  ): Observable<DataQueryResponse> {
    return queryFn(request).pipe(
      map((res) => {
        const dataframes: DataFrame[] = res.data || [];

        dataframes.forEach((frame) => {
          frame.fields.forEach((field) => {
            if (field.type === FieldType.time) {
              // field.config.interval is populated in order for Grafana to fill in null values at frame intervals
              field.config.interval = frame.meta?.custom?.period * 1000;
            }
          });
        });

        return {
          data: dataframes,
          // DataSourceWithBackend will not throw an error, instead it will return "errors" field along with the response
          errors: res.errors,
        };
      }),
      catchError((err: any) => {
        if (Array.isArray(err)) {
          return of({ data: [], errors: err });
        } else {
          return of({ data: [], errors: [{ message: err.toString() }] });
        }
      })
    );
  }

  filterMetricQuery(query: CloudWatchMetricsQuery): boolean {
    return filterMetricsQuery(query);
  }

  replaceMetricQueryVars(query: CloudWatchMetricsQuery, scopedVars: ScopedVars): CloudWatchMetricsQuery {
    query.region = this.templateSrv.replace(this.getActualRegion(query.region), scopedVars);
    query.namespace = this.replaceVariableAndDisplayWarningIfMulti(query.namespace, scopedVars, true, 'namespace');
    query.metricName = this.replaceVariableAndDisplayWarningIfMulti(query.metricName, scopedVars, true, 'metric name');
    query.dimensions = this.convertDimensionFormat(query.dimensions ?? {}, scopedVars);
    query.statistic = this.templateSrv.replace(query.statistic, scopedVars);
    query.period = String(this.getPeriod(query, scopedVars)); // use string format for period in graph query, and alerting
    query.id = this.templateSrv.replace(query.id, scopedVars);
    query.expression = this.templateSrv.replace(query.expression, scopedVars);
    query.sqlExpression = this.templateSrv.replace(query.sqlExpression, scopedVars, 'raw');
    if (query.accountId) {
      query.accountId = this.templateSrv.replace(query.accountId, scopedVars);
    }

    return query;
  }

  getPeriod(target: CloudWatchMetricsQuery, scopedVars: ScopedVars) {
    let period = this.templateSrv.replace(target.period, scopedVars);
    if (period && period.toLowerCase() !== 'auto') {
      let p: number;
      if (/^\d+$/.test(period)) {
        p = parseInt(period, 10);
      } else {
        p = rangeUtil.intervalToSeconds(period);
      }

      if (p < 1) {
        p = 1;
      }

      return String(p);
    }

    return period;
  }
}
