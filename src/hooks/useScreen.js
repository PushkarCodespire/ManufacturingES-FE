import { Grid } from 'antd';

const { useBreakpoint } = Grid;

/**
 * useScreen — thin wrapper around antd's useBreakpoint.
 * Returns three named booleans so pages can branch on layout without
 * importing / calling Grid.useBreakpoint directly.
 *
 * isMobile  : < 768 px  (xs / sm)  — sidebar is a Drawer overlay
 * isTablet  : 768–1023 px (md)     — sidebar force-collapsed (64 px)
 * isDesktop : ≥ 1024 px (lg+)      — full sidebar, user controls collapse
 */
export default function useScreen() {
  const bp = useBreakpoint();

  return {
    isMobile:  !bp.md,
    isTablet:  !!(bp.md && !bp.lg),
    isDesktop: !!bp.lg,
    bp,
  };
}
