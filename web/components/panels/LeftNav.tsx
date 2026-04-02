// web/components/panels/LeftNav.tsx
'use client';

import { useGraphStore } from '@/stores/graphStore';

export default function LeftNav() {
  const { graphIndex, setDomainFilter, domainFilter } = useGraphStore();

  if (!graphIndex) return null;

  return (
    <aside style={{
      width: 280,
      height: 'calc(100vh - 52px)',
      position: 'fixed',
      top: 52,
      left: 0,
      background: 'rgba(22,27,34,0.6)',
      borderRight: '1px solid var(--border-dim)',
      overflowY: 'auto',
      padding: '16px 0',
    }}>
      <div style={{ padding: '0 16px 8px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        知识领域
      </div>
      <div
        onClick={() => setDomainFilter('')}
        style={{
          padding: '8px 16px',
          fontSize: 13,
          color: domainFilter === '' ? 'var(--primary)' : 'var(--text-secondary)',
          cursor: 'pointer',
          background: domainFilter === '' ? 'rgba(0,245,255,0.08)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <span style={{ color: 'var(--text-muted)', fontSize: 11, marginRight: 8 }}>
          {graphIndex.stats.total_notes}
        </span>
        全部笔记
      </div>
      {graphIndex.domains.map(domain => (
        <div
          key={domain}
          onClick={() => setDomainFilter(domain)}
          style={{
            padding: '8px 16px',
            fontSize: 13,
            color: domainFilter === domain ? 'var(--primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            background: domainFilter === domain ? 'rgba(0,245,255,0.08)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: DOMAIN_COLORS[domain] ?? '#6B7280',
            marginRight: 8, flexShrink: 0,
          }} />
          <span style={{ flex: 1 }}>{domain}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            {graphIndex.stats.by_domain[domain] ?? 0}
          </span>
        </div>
      ))}
    </aside>
  );
}

const DOMAIN_COLORS: Record<string, string> = {
  'AI 核心技术与模型':   '#2563EB',
  'AI 产业生态与巨头':  '#7C3AED',
  'AI 智能体与工程':    '#00F5FF',
  '管理、职场与个人成长': '#D97706',
  '行业应用与生活闲谈': '#DB2777',
  '企业数字化与数据治理': '#0284C7',
  '社会、安全与伦理':  '#7C22CE',
  '其他':               '#6B7280',
};
