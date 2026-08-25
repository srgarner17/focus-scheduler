import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Not using vitest's `globals: true`, so React Testing Library's built-in
// auto-cleanup (which looks for a global afterEach) never registers itself —
// without this, each render() in a component test file leaks its container
// into the next test, and queries start matching duplicate elements.
afterEach(cleanup);
