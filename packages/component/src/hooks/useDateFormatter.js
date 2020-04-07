import { useMemo } from 'react';

import useLocalizedGlobalize from './internal/useLocalizedGlobalize';

export default function useDateFormatter() {
  const [globalize] = useLocalizedGlobalize();

  const formatDate = useMemo(() => date => globalize.dateFormatter({ skeleton: 'MMMMdhm' })(new Date(date)), [
    globalize
  ]);

  return formatDate;
}
