import type { ReplayDraft } from '../types';

export function ReplayDialog(props: {
  busy: boolean;
  draft: ReplayDraft | null;
  error: string | null;
  host: string;
  onBodyChange: (bodyText: string) => void;
  onClose: () => void;
  onPathChange: (path: string) => void;
  onSubmit: () => void;
}) {
  if (!props.draft) {
    return null;
  }

  const showBodyField = props.draft.method !== 'GET' && props.draft.method !== 'DELETE';
  const hasBodyContent = props.draft.bodyText.trim().length > 0;

  return (
    <div className="modal-backdrop" role="presentation">
      <div aria-modal="true" className="modal-card" role="dialog">
        <div className="modal-header">
          <div>
            <p className="endpoint-card__eyebrow">Replay request</p>
            <h2>{props.draft.title}</h2>
          </div>
          <button className="secondary-button secondary-button--small" onClick={props.onClose}>
            Close
          </button>
        </div>

        <div className="form-grid modal-grid">
          <label className="field-block modal-method-field">
            <span>Method</span>
            <input disabled value={props.draft.method} />
          </label>
          <label className="field-block modal-url-field">
            <span>Path (editable)</span>
            <div className="path-input-group">
              <span className="path-input-prefix">{props.host}</span>
              <input value={props.draft.path} onChange={event => props.onPathChange(event.target.value)} />
            </div>
          </label>
        </div>

        {showBodyField || hasBodyContent ? (
          <label className="field-block">
            <span>Request body JSON (editable)</span>
            <textarea
              rows={14}
              spellCheck={false}
              value={props.draft.bodyText}
              onChange={event => props.onBodyChange(event.target.value)}
            />
          </label>
        ) : null}

        {props.error ? <p className="error-text">{props.error}</p> : null}

        <div className="modal-actions">
          <button className="action-button" disabled={props.busy} onClick={props.onSubmit}>
            {props.busy ? 'Sending...' : 'Send replayed request'}
          </button>
        </div>
      </div>
    </div>
  );
}
