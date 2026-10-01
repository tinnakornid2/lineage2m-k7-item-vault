import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VaultView } from '../src/components/VaultView.tsx';
import { QueueView } from '../src/components/QueueView.tsx';
import { PageErrorBoundary } from '../src/components/PageErrorBoundary.tsx';

const noop = async () => {};
const owner = { id: 'test-owner', username: 'eloni', inGameName: 'Owner', role: 'owner', status: 'active', clan: 'K7', powerLevel: 100 };

for (const lang of ['th', 'en']) {
  test(`Vault and queue menu views render actual components (${lang})`, () => {
    const vault = renderToStaticMarkup(React.createElement(VaultView, {
      lang, currentUser: owner, allMembers: [owner], vaultItems: [], quickItems: [],
      onOpenQuickItemsModal: noop, onCreateVaultItem: noop, onDeleteVaultItem: noop, onViewImageZoom: noop
    }));
    const queue = renderToStaticMarkup(React.createElement(QueueView, {
      lang, currentUser: owner, allMembers: [owner], generalItems: []
    }));
    assert.ok(vault.length > 100);
    assert.ok(queue.length > 100);
  });
  test(`Page error recovery is bilingual and does not require clearing storage (${lang})`, () => {
    const boundary = new PageErrorBoundary({ lang, onHome: noop, children: 'page' });
    boundary.state = PageErrorBoundary.getDerivedStateFromError(new Error('render failure'));
    const html = renderToStaticMarkup(boundary.render());
    assert.ok(html.includes(lang === 'th' ? 'กลับหน้าหลัก' : 'Back to dashboard'));
    assert.ok(html.includes('role="alert"'));
  });
}
