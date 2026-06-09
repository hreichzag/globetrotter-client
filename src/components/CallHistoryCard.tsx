import { formatJson } from '../api';
import type { CallRecord } from '../types';
import { InfoCard } from './InfoCard';

export function CallHistoryCard(props: { calls: CallRecord[]; onReplay: (call: CallRecord) => void }) {
  return (
    <InfoCard title="Latest calls">
      {props.calls.length === 0 ? (
        <p className="muted">Run a call to inspect request + response here.</p>
      ) : (
        <div className="log-list">
          {props.calls.map(call => (
            <article className="log-card" key={call.key}>
              <div className="log-header">
                <strong>{call.title}</strong>
                <span className={call.response.ok ? 'status-badge status-badge--ok' : 'status-badge status-badge--error'}>
                  {call.response.status || 'ERR'}
                </span>
              </div>
              <div className="log-meta">
                <span>{call.request.method}</span>
                <span>{call.timestamp}</span>
              </div>
              <button className="secondary-button" onClick={() => props.onReplay(call)}>
                Replay / edit request
              </button>
              <details>
                <summary>Request</summary>
                <pre>{formatJson(call.request)}</pre>
              </details>
              <details>
                <summary>Response</summary>
                <pre>{formatJson(call.response.data)}</pre>
              </details>
            </article>
          ))}
        </div>
      )}
    </InfoCard>
  );
}
