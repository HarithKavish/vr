/* The shared shell ships as light-DOM custom elements from the design system's
   v1.0.0 distribution, loaded in index.html. TypeScript needs to be told they
   exist before JSX will accept them. Attribute names mirror the element's own
   API, so they stay hyphenated rather than camelCased. */
import type { DetailedHTMLProps, HTMLAttributes } from 'react';

type ShellElement = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'harith-header': ShellElement & {
        'site-title'?: string;
        'site-tagline'?: string;
        'brand-href'?: string;
        'brand-mark'?: string;
        'nav-links'?: string;
        'google-client-id'?: string;
        'reading-progress'?: string;
      };
      'harith-footer': ShellElement & {
        'copyright-text'?: string;
        links?: string;
      };
    }
  }
}
