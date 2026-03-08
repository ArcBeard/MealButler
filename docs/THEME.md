# MealApp Theme Reference

## IMPORTANT: Never delete this file. It is the project's theme source of truth.

## Source
- Material Theme Builder export
- Seed color: `#63A002`
- Source file: `/mnt/c/Users/mr_gr/Documents/material-theme.json`

## Color Mapping: Material Design → shadcn CSS Variables

### Light Scheme

| CSS Variable | Material Token | Hex | OKLCH |
|---|---|---|---|
| `--background` | surface | `#F9FAEF` | `oklch(98.14% 0.0144 111.03)` |
| `--foreground` | onSurface | `#1A1C16` | `oklch(22.21% 0.0117 122.42)` |
| `--card` | surfaceContainerLow | `#F3F4E9` | `oklch(96.34% 0.0145 111.03)` |
| `--card-foreground` | onSurface | `#1A1C16` | `oklch(22.21% 0.0117 122.42)` |
| `--popover` | surfaceContainer | `#EEEFE3` | `oklch(94.81% 0.0159 110.7)` |
| `--popover-foreground` | onSurface | `#1A1C16` | `oklch(22.21% 0.0117 122.42)` |
| `--primary` | primary | `#4C662B` | `oklch(47.52% 0.0907 129.14)` |
| `--primary-foreground` | onPrimary | `#FFFFFF` | `oklch(100.0% 0 0)` |
| `--secondary` | secondaryContainer | `#DCE7C8` | `oklch(91.15% 0.0428 123.23)` |
| `--secondary-foreground` | onSecondaryContainer | `#404A33` | `oklch(39.32% 0.0394 127.25)` |
| `--muted` | surfaceContainerHighest | `#E2E3D8` | `oklch(91.2% 0.0147 111.04)` |
| `--muted-foreground` | outline | `#75796C` | `oklch(56.87% 0.02 121.06)` |
| `--accent` | surfaceContainerHigh | `#E8E9DE` | `oklch(93.02% 0.0146 111.04)` |
| `--accent-foreground` | onSurface | `#1A1C16` | `oklch(22.21% 0.0117 122.42)` |
| `--destructive` | error | `#BA1A1A` | `oklch(50.6% 0.1926 27.69)` |
| `--destructive-foreground` | onError | `#FFFFFF` | `oklch(100.0% 0 0)` |
| `--border` | outlineVariant | `#C5C8BA` | `oklch(82.65% 0.0194 116.77)` |
| `--input` | outlineVariant | `#C5C8BA` | `oklch(82.65% 0.0194 116.77)` |
| `--ring` | primary | `#4C662B` | `oklch(47.52% 0.0907 129.14)` |

### Dark Scheme

| CSS Variable | Material Token | Hex | OKLCH |
|---|---|---|---|
| `--background` | surface | `#12140E` | `oklch(18.67% 0.0122 122.62)` |
| `--foreground` | onSurface | `#E2E3D8` | `oklch(91.2% 0.0147 111.04)` |
| `--card` | surfaceContainerLow | `#1A1C16` | `oklch(22.21% 0.0117 122.42)` |
| `--card-foreground` | onSurface | `#E2E3D8` | `oklch(91.2% 0.0147 111.04)` |
| `--popover` | surfaceContainer | `#1E201A` | `oklch(23.92% 0.0115 122.35)` |
| `--popover-foreground` | onSurface | `#E2E3D8` | `oklch(91.2% 0.0147 111.04)` |
| `--primary` | primary | `#B1D18A` | `oklch(82.0% 0.1006 128.2)` |
| `--primary-foreground` | onPrimary | `#1F3701` | `oklch(30.52% 0.0828 131.51)` |
| `--secondary` | secondaryContainer | `#404A33` | `oklch(39.32% 0.0394 127.25)` |
| `--secondary-foreground` | onSecondaryContainer | `#DCE7C8` | `oklch(91.15% 0.0428 123.23)` |
| `--muted` | surfaceContainerHighest | `#33362E` | `oklch(32.72% 0.0143 124.03)` |
| `--muted-foreground` | outline | `#8F9285` | `oklch(65.36% 0.0191 117.59)` |
| `--accent` | surfaceContainerHigh | `#282B24` | `oklch(28.36% 0.0132 126.26)` |
| `--accent-foreground` | onSurface | `#E2E3D8` | `oklch(91.2% 0.0147 111.04)` |
| `--destructive` | error | `#FFB4AB` | `oklch(83.83% 0.089 26.72)` |
| `--destructive-foreground` | onError | `#690005` | `oklch(32.75% 0.1336 27.31)` |
| `--border` | outlineVariant | `#44483D` | `oklch(39.44% 0.0188 123.61)` |
| `--input` | outlineVariant | `#44483D` | `oklch(39.44% 0.0188 123.61)` |
| `--ring` | primary | `#B1D18A` | `oklch(82.0% 0.1006 128.2)` |

### Sidebar Variables (same pattern for both schemes)

| CSS Variable | Material Token |
|---|---|
| `--sidebar-background` | surfaceContainerLow |
| `--sidebar-foreground` | onSurface |
| `--sidebar-primary` | primary |
| `--sidebar-primary-foreground` | onPrimary |
| `--sidebar-accent` | surfaceContainerHigh |
| `--sidebar-accent-foreground` | onSurface |
| `--sidebar-border` | outlineVariant |
| `--sidebar-ring` | primary |

### Chart Colors

| Variable | Light (Material Token) | Dark (Material Token) |
|---|---|---|
| `--chart-1` | primary `#4C662B` | primary `#B1D18A` |
| `--chart-2` | tertiary `#386663` | tertiary `#A0D0CB` |
| `--chart-3` | secondary `#586249` | secondary `#BFCBAD` |
| `--chart-4` | primary-60 `#64A104` | primary-80 `#97D945` |
| `--chart-5` | tertiary-60 `#4D9D98` | tertiaryContainer `#BCECE7` |

## Additional Material Tokens (for reference)

### Light Scheme Extended

| Token | Hex | OKLCH |
|---|---|---|
| surfaceDim | `#DADBD0` | `oklch(88.76% 0.0148 111.05)` |
| inverseSurface | `#2F312A` | `oklch(30.87% 0.0125 120.18)` |
| inverseOnSurface | `#F1F2E6` | `oklch(95.71% 0.0158 110.7)` |
| inversePrimary | `#B1D18A` | `oklch(82.0% 0.1006 128.2)` |
| primaryContainer | `#CDEDA3` | `oklch(90.53% 0.1022 127.36)` |
| onPrimaryContainer | `#354E16` | `oklch(39.04% 0.087 130.21)` |
| tertiaryContainer | `#BCECE7` | `oklch(90.83% 0.0498 188.57)` |
| onTertiaryContainer | `#1F4E4B` | `oklch(39.06% 0.0513 189.64)` |
| errorContainer | `#FFDAD6` | `oklch(91.83% 0.0417 25.14)` |
| onErrorContainer | `#93000A` | `oklch(41.71% 0.1701 27.37)` |

### Dark Scheme Extended

| Token | Hex | OKLCH |
|---|---|---|
| surfaceDim | `#12140E` | `oklch(18.67% 0.0122 122.62)` |
| surfaceBright | `#383A32` | `oklch(34.38% 0.0138 118.62)` |
| surfaceContainerLowest | `#0C0F09` | `oklch(16.27% 0.0132 129.37)` |
| inverseSurface | `#E2E3D8` | `oklch(91.2% 0.0147 111.04)` |
| inverseOnSurface | `#2F312A` | `oklch(30.87% 0.0125 120.18)` |
| inversePrimary | `#4C662B` | `oklch(47.52% 0.0907 129.14)` |
| primaryContainer | `#354E16` | `oklch(39.04% 0.087 130.21)` |
| onPrimaryContainer | `#CDEDA3` | `oklch(90.53% 0.1022 127.36)` |
| tertiaryContainer | `#1F4E4B` | `oklch(39.06% 0.0513 189.64)` |
| onTertiaryContainer | `#BCECE7` | `oklch(90.83% 0.0498 188.57)` |
| errorContainer | `#93000A` | `oklch(41.71% 0.1701 27.37)` |
| onErrorContainer | `#FFDAD6` | `oklch(91.83% 0.0417 25.14)` |
