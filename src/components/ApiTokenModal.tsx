import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api/client';
import { useLanguage } from '../i18n/LanguageContext';
import {
  KeyIcon,
  XIcon,
  CopyIcon,
  CheckIcon,
  LoaderIcon,
  TrashIcon,
  PlusIcon,
} from './Icons';

interface Props {
  open: boolean;
  onClose: () => void;
}

type ClientType = 'cursor' | 'claude_desktop' | 'claude_code' | 'antigravity' | 'env';

interface ClientOption {
  id: ClientType;
  label: string;
  hint: string;
}

interface TokenItem {
  id: string;
  name: string;
  tokenPreview: string;
  createdAt: string;
  expiresAt: number;
}

const CLIENT_OPTIONS: ClientOption[] = [
  { id: 'cursor', label: 'Cursor', hint: '.cursor/mcp.json' },
  { id: 'claude_desktop', label: 'Claude Desktop', hint: 'claude_desktop_config.json' },
  { id: 'claude_code', label: 'Claude Code', hint: 'Terminal CLI' },
  { id: 'antigravity', label: 'Antigravity', hint: 'mcp_config.json' },
  { id: 'env', label: '.env', hint: 'Environment variables' },
];

export function ApiTokenModal({ open, onClose }: Props) {
  const { t } = useLanguage();
  const modalRef = useRef<HTMLDivElement | null>(null);

  const [view, setView] = useState<'list' | 'create'>('list');
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [tokenName, setTokenName] = useState('');

  // Generated token state
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [generatedExpiresAt, setGeneratedExpiresAt] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientType>('cursor');
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Load tokens when opening modal
  useEffect(() => {
    if (!open) return;
    loadTokens();
  }, [open]);

  const loadTokens = async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await api.auth.listTokens();
      setTokens(res.tokens || []);
      // If user has no tokens and hasn't just generated one, switch to create view
      if (!generatedToken && (!res.tokens || res.tokens.length === 0)) {
        setView('create');
      }
    } catch (err: any) {
      console.error('Failed to load tokens:', err);
    } finally {
      setLoadingList(false);
    }
  };

  // Reset copied indicators after 2 seconds
  useEffect(() => {
    if (!copiedToken) return;
    const timer = setTimeout(() => setCopiedToken(false), 2000);
    return () => clearTimeout(timer);
  }, [copiedToken]);

  useEffect(() => {
    if (!copiedConfig) return;
    const timer = setTimeout(() => setCopiedConfig(false), 2000);
    return () => clearTimeout(timer);
  }, [copiedConfig]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await api.auth.createToken(tokenName.trim() || undefined, 365);
      setGeneratedToken(res.token);
      setGeneratedExpiresAt(res.expiresAt);
      setTokenName('');
      setView('create');
      loadTokens();
    } catch (err: any) {
      console.error('Failed to generate token:', err);
      setError(err?.message || 'Failed to generate token');
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      await api.auth.deleteToken(id);
      setTokens((prev) => prev.filter((t) => t.id !== id));
      setConfirmRevokeId(null);
    } catch (err: any) {
      console.error('Failed to revoke token:', err);
      setError(err?.message || 'Failed to revoke token');
    } finally {
      setRevokingId(null);
    }
  };

  const copyToClipboard = async (text: string, isConfig = false) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isConfig) {
        setCopiedConfig(true);
      } else {
        setCopiedToken(true);
      }
    } catch {
      // Fallback
    }
  };

  if (!open) return null;

  // Localhost points to Express on port 3000; Cloudflare Pages uses origin domain
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const backendUrl = isLocalhost
    ? `http://${window.location.hostname}:3000`
    : window.location.origin;

  const currentToken = generatedToken || 'YOUR_TOKEN_HERE';

  const getClientSnippet = (client: ClientType): string => {
    switch (client) {
      case 'cursor':
        return JSON.stringify(
          {
            mcpServers: {
              parasti: {
                command: 'npx',
                args: ['-y', 'tsx', 'mcp/index.ts'],
                env: {
                  PARASTI_URL: backendUrl,
                  PARASTI_API_TOKEN: currentToken,
                },
              },
            },
          },
          null,
          2
        );

      case 'claude_desktop':
        return JSON.stringify(
          {
            mcpServers: {
              parasti: {
                command: 'npx',
                args: ['-y', 'tsx', 'path/to/parasti/mcp/index.ts'],
                env: {
                  PARASTI_URL: backendUrl,
                  PARASTI_API_TOKEN: currentToken,
                },
              },
            },
          },
          null,
          2
        );

      case 'claude_code':
        return `claude mcp add parasti npx -y tsx mcp/index.ts --env PARASTI_URL="${backendUrl}" --env PARASTI_API_TOKEN="${currentToken}"`;

      case 'antigravity':
        return JSON.stringify(
          {
            mcpServers: {
              parasti: {
                command: 'npx',
                args: ['-y', 'tsx', 'mcp/index.ts'],
                env: {
                  PARASTI_URL: backendUrl,
                  PARASTI_API_TOKEN: currentToken,
                },
              },
            },
          },
          null,
          2
        );

      case 'env':
        return `PARASTI_URL="${backendUrl}"\nPARASTI_API_TOKEN="${currentToken}"`;

      default:
        return '';
    }
  };

  const currentSnippet = getClientSnippet(selectedClient);
  const activeOption = CLIENT_OPTIONS.find((c) => c.id === selectedClient);

  const formattedDate = generatedExpiresAt
    ? new Date(generatedExpiresAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  return createPortal(
    <div
      className="import-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-token-modal-title"
        style={{ maxWidth: 620, maxHeight: '88vh' }}
      >
        <header className="import-modal-header">
          <div className="import-modal-title-wrap">
            <KeyIcon size={18} />
            <h2 id="api-token-modal-title" className="import-modal-title">
              {t('apiToken.title')}
            </h2>
          </div>
          <button
            type="button"
            className="import-modal-close-btn"
            onClick={onClose}
            aria-label={t('apiToken.close')}
          >
            <XIcon size={16} />
          </button>
        </header>

        <p className="import-modal-subtitle">{t('apiToken.subtitle')}</p>

        {/* View toggle header when tokens exist */}
        {tokens.length > 0 && (
          <div
            style={{
              padding: '0 20px 10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => {
                  setView('list');
                  setGeneratedToken(null);
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: view === 'list' && !generatedToken ? 600 : 400,
                  background: view === 'list' && !generatedToken ? 'var(--accent, #6366f1)' : 'var(--bg-hover, rgba(255,255,255,0.06))',
                  color: view === 'list' && !generatedToken ? '#ffffff' : 'var(--text-secondary, #999)',
                  cursor: 'pointer',
                  transition: 'all 120ms',
                }}
              >
                {t('apiToken.activeTokens')} ({tokens.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setView('create');
                  setGeneratedToken(null);
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: view === 'create' || generatedToken ? 600 : 400,
                  background: view === 'create' || generatedToken ? 'var(--accent, #6366f1)' : 'var(--bg-hover, rgba(255,255,255,0.06))',
                  color: view === 'create' || generatedToken ? '#ffffff' : 'var(--text-secondary, #999)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 120ms',
                }}
              >
                <PlusIcon size={14} />
                <span>{t('apiToken.createNew')}</span>
              </button>
            </div>
          </div>
        )}

        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#ef4444',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {/* LIST VIEW */}
          {view === 'list' && !generatedToken && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {loadingList ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary, #999)' }}>
                  <LoaderIcon size={20} className="spin" />
                </div>
              ) : tokens.length === 0 ? (
                <div
                  style={{
                    padding: 30,
                    textAlign: 'center',
                    border: '1px dashed var(--border-color, #2e2e38)',
                    borderRadius: 8,
                    color: 'var(--text-secondary, #999)',
                    fontSize: 13,
                  }}
                >
                  {t('apiToken.noTokens')}
                </div>
              ) : (
                tokens.map((tk) => {
                  const isConfirming = confirmRevokeId === tk.id;
                  const isRevoking = revokingId === tk.id;
                  const expDate = new Date(tk.expiresAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <div
                      key={tk.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 8,
                        background: 'var(--bg-secondary, #212126)',
                        border: '1px solid var(--border-color, #2e2e38)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: 'var(--bg-hover, rgba(255,255,255,0.06))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            color: 'var(--accent, #6366f1)',
                          }}
                        >
                          <KeyIcon size={16} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #e8e8ea)' }}>
                            {tk.name}
                          </span>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-tertiary, #777)' }}>
                              {tk.tokenPreview}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary, #777)' }}>
                              • {expDate}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div>
                        {isConfirming ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRevoke(tk.id)}
                              disabled={isRevoking}
                              style={{
                                padding: '4px 10px',
                                borderRadius: 6,
                                background: '#ef4444',
                                color: '#ffffff',
                                border: 'none',
                                fontSize: 12,
                                fontWeight: 500,
                                cursor: 'pointer',
                              }}
                            >
                              {isRevoking ? <LoaderIcon size={12} className="spin" /> : t('apiToken.revoke')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRevokeId(null)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: 6,
                                background: 'transparent',
                                color: 'var(--text-secondary, #999)',
                                border: '1px solid var(--border-color, #2e2e38)',
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRevokeId(tk.id)}
                            title={t('apiToken.revoke')}
                            style={{
                              padding: '6px 8px',
                              borderRadius: 6,
                              background: 'transparent',
                              color: 'var(--text-tertiary, #777)',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'color 120ms',
                            }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ef4444')}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary, #777)')}
                          >
                            <TrashIcon size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* CREATE VIEW (BEFORE TOKEN GENERATED) */}
          {view === 'create' && !generatedToken && (
            <div
              style={{
                padding: 24,
                borderRadius: 10,
                border: '1px dashed var(--border-color, #2e2e38)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'var(--bg-hover, rgba(255,255,255,0.06))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent, #6366f1)',
                }}
              >
                <KeyIcon size={24} />
              </div>

              {/* Name input */}
              <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #999)' }}>
                  {t('apiToken.nameLabel')}
                </label>
                <input
                  type="text"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder={t('apiToken.namePlaceholder')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'var(--bg-secondary, #212126)',
                    border: '1px solid var(--border-color, #2e2e38)',
                    color: 'var(--text-primary, #e8e8ea)',
                    fontSize: 13,
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleGenerate();
                  }}
                />
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 20px',
                  borderRadius: 8,
                  background: 'var(--accent, #6366f1)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 500,
                  fontSize: 14,
                  cursor: generating ? 'not-allowed' : 'pointer',
                  opacity: generating ? 0.7 : 1,
                  transition: 'opacity 120ms',
                }}
              >
                {generating ? (
                  <>
                    <LoaderIcon size={16} className="spin" />
                    <span>{t('apiToken.generating')}</span>
                  </>
                ) : (
                  <>
                    <KeyIcon size={16} />
                    <span>{t('apiToken.generate')}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* GENERATED TOKEN SUCCESS VIEW */}
          {generatedToken && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  color: '#10b981',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <CheckIcon size={16} />
                <span>
                  {t('apiToken.generatedNotice')} ({t('apiToken.validity')} — {formattedDate})
                </span>
              </div>

              {/* Token copy box */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #999)' }}>
                  Personal API Token:
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    readOnly
                    value={generatedToken}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'var(--bg-secondary, #212126)',
                      border: '1px solid var(--border-color, #2e2e38)',
                      color: 'var(--text-primary, #e8e8ea)',
                      fontFamily: 'monospace',
                      fontSize: 12,
                    }}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(generatedToken)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 14px',
                      borderRadius: 8,
                      background: copiedToken ? '#10b981' : 'var(--bg-hover, rgba(255,255,255,0.08))',
                      color: copiedToken ? '#ffffff' : 'var(--text-primary, #e8e8ea)',
                      border: '1px solid var(--border-color, #2e2e38)',
                      fontSize: 13,
                      cursor: 'pointer',
                      transition: 'all 150ms',
                    }}
                  >
                    {copiedToken ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
                    <span>{copiedToken ? t('apiToken.copied') : t('apiToken.copy')}</span>
                  </button>
                </div>
              </div>

              {/* Client Selector & Snippet */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #999)' }}>
                    {t('apiToken.configHint')}
                  </label>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(currentSnippet, true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: copiedConfig ? '#10b981' : 'var(--accent, #6366f1)',
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: 0,
                    }}
                  >
                    {copiedConfig ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
                    <span>
                      {copiedConfig
                        ? t('apiToken.copied')
                        : selectedClient === 'claude_code'
                        ? 'Copy Command'
                        : selectedClient === 'env'
                        ? 'Copy .env'
                        : 'Copy JSON'}
                    </span>
                  </button>
                </div>

                {/* Client selector tabs */}
                <div
                  style={{
                    display: 'flex',
                    gap: 6,
                    flexWrap: 'wrap',
                    padding: '4px',
                    borderRadius: 8,
                    background: 'var(--bg-secondary, #1b1b1f)',
                    border: '1px solid var(--border-color, #2e2e38)',
                  }}
                >
                  {CLIENT_OPTIONS.map((opt) => {
                    const isSelected = selectedClient === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedClient(opt.id)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: 'none',
                          fontSize: 12,
                          fontWeight: isSelected ? 600 : 400,
                          background: isSelected ? 'var(--accent, #6366f1)' : 'transparent',
                          color: isSelected ? '#ffffff' : 'var(--text-secondary, #999)',
                          cursor: 'pointer',
                          transition: 'all 120ms',
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {/* Sub-hint for where to paste */}
                <div style={{ fontSize: 11, color: 'var(--text-tertiary, #777)' }}>
                  Target: <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary, #aaa)' }}>{activeOption?.hint}</span>
                </div>

                <pre
                  style={{
                    margin: 0,
                    padding: 12,
                    borderRadius: 8,
                    background: 'var(--bg-secondary, #141416)',
                    border: '1px solid var(--border-color, #2e2e38)',
                    color: '#d4d4d8',
                    fontFamily: 'monospace',
                    fontSize: 11,
                    overflowX: 'auto',
                    maxHeight: 140,
                    whiteSpace: selectedClient === 'claude_code' ? 'pre-wrap' : 'pre',
                    wordBreak: selectedClient === 'claude_code' ? 'break-all' : 'normal',
                  }}
                >
                  {currentSnippet}
                </pre>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => {
                    setGeneratedToken(null);
                    setView('list');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary, #888)',
                    fontSize: 12,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                >
                  {t('apiToken.backToList')}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 8,
                    background: 'var(--accent, #6366f1)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  {t('apiToken.close')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
