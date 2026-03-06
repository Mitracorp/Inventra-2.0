import { useEffect } from 'react';

/**
 * Custom hook to dynamically set the document title
 * @param {string} title - The title to set for the page
 * @param {string} [prefix='Inventra'] - Optional prefix for the title
 */
const usePageTitle = (title, prefix = 'Inventra') => {
  useEffect(() => {
    if (title) {
      document.title = `${prefix} | ${title}`;
    } else {
      document.title = prefix;
    }

    // Cleanup: reset to default title when component unmounts
    return () => {
      document.title = prefix;
    };
  }, [title, prefix]);
};

export default usePageTitle;
