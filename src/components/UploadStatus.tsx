// Progress / error strip shown on a block while its file is uploading. Used by
// both the image block (overlaid on the local preview) and the file block.

import { UploadState } from '../types';
import { XIcon } from './Icons';
import { useLanguage } from '../i18n/LanguageContext';

interface Props {
  upload: UploadState;
  onCancel?: () => void;
  onRetry?: () => void;
}

export function UploadStatus({ upload, onCancel, onRetry }: Props) {
  const { t } = useLanguage();

  if (upload.status === 'error') {
    return (
      <div className="upload-status upload-status--error" role="alert">
        <span className="upload-status-text">{upload.error}</span>
        <div className="upload-status-actions">
          {onRetry && (
            <button type="button" className="upload-status-btn upload-status-btn--primary" onClick={onRetry}>
              {t('editor.uploadRetry')}
            </button>
          )}
          {onCancel && (
            <button type="button" className="upload-status-btn" onClick={onCancel}>
              {t('editor.uploadRemove')}
            </button>
          )}
        </div>
      </div>
    );
  }

  const percent = Math.round(upload.progress * 100);
  // Nothing sent yet (queued, or compressing the image): no honest percentage to show.
  const indeterminate = upload.status === 'queued' || percent === 0;

  return (
    <div className="upload-status">
      <div className="upload-status-row">
        <span className="upload-status-text">
          {upload.status === 'queued' ? t('editor.uploadQueued') : t('editor.uploadProgress', { percent })}
        </span>
        {/* Once everything is sent the block is being saved; too late to cancel. */}
        {onCancel && upload.progress < 1 && (
          <button
            type="button"
            className="upload-status-icon-btn"
            onClick={onCancel}
            aria-label={t('editor.uploadCancel')}
            title={t('editor.uploadCancel')}
          >
            <XIcon size={14} />
          </button>
        )}
      </div>
      <div
        className={`upload-bar${indeterminate ? ' upload-bar--indeterminate' : ''}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : percent}
      >
        <div className="upload-bar-fill" style={indeterminate ? undefined : { width: `${percent}%` }} />
      </div>
    </div>
  );
}
