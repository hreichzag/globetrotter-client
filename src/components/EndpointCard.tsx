import type { ReactNode } from 'react';
import { formatJson } from '../api';
import type { CallRecord } from '../types';

export function EndpointCard(props: {
  action?: ReactNode;
  children: ReactNode;
  codeSample?: string;
  docsUrl: string;
  endpoint: string;
  latestCall?: CallRecord | null;
  method: string;
  permission: string;
  title: string;
  tone?: 'default' | 'danger';
}) {
  return (
    <article className={`endpoint-card ${props.tone === 'danger' ? 'endpoint-card--danger' : ''}`}>
      <div className="endpoint-card__header">
        <div>
          <p className="endpoint-card__eyebrow">{props.method}</p>
          <h2>{props.title}</h2>
          <p className="muted endpoint-card__path">
            <a className="endpoint-link" href={props.docsUrl} rel="noreferrer" target="_blank">
              {props.endpoint}
            </a>
          </p>
        </div>
        <span className="permission-chip">{props.permission}</span>
      </div>

      <p className="endpoint-card__body">{props.children}</p>

      {props.action ? <div className="endpoint-card__action">{props.action}</div> : null}

      {props.codeSample ? (
        <details>
          <summary>Payload / sample</summary>
          <pre>{props.codeSample}</pre>
        </details>
      ) : null}

      {props.latestCall ? (
        <details>
          <summary>Latest response ({props.latestCall.response.status || 'ERR'})</summary>
          <pre>{formatJson(props.latestCall.response.data)}</pre>
        </details>
      ) : null}
    </article>
  );
}
