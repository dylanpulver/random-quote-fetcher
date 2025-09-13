/**
 * Theme script component to prevent FOUC (Flash of Unstyled Content)
 * This runs before React hydration to set the initial theme
 */
export function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            try {
              var theme = localStorage.getItem('theme') || 'light';
              document.documentElement.setAttribute('data-theme', theme);
            } catch (e) {
              // localStorage might not be available (private browsing, etc.)
              console.warn('Could not access localStorage for theme');
            }
          })();
        `,
      }}
    />
  );
}