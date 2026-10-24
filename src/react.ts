// React comes from the cdnjs UMD build loaded by the page; this shim gives typed access.
import type * as ReactNS from 'react';
import type * as ReactDOMClient from 'react-dom/client';
export const React: typeof ReactNS = (window as any).React;
export const ReactDOM: typeof ReactDOMClient = (window as any).ReactDOM;
export const { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect, useSyncExternalStore, Fragment } = React;
