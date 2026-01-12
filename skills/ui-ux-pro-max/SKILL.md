---
name: ui-ux-pro-max
description: Design intelligence database for building professional UI/UX across multiple platforms. Use when designing interfaces, selecting color palettes, choosing typography, implementing UI styles (Glassmorphism, Neumorphism, etc.), or following UX best practices. Provides 57 UI styles, 95 color palettes, 56 font pairings, 24 chart types, and 98 UX guidelines for React, Next.js, Vue, Nuxt, SwiftUI, React Native, Flutter, and HTML+Tailwind.
---

# UI UX Pro Max

Searchable database of UI styles, color palettes, font pairings, chart types, product recommendations, UX guidelines, and stack-specific best practices.

## Quick Start

When user requests UI/UX work (design, build, create, implement, review, fix, improve), use the search script:

```bash
python3 .shared/ui-ux-pro-max/scripts/search.py "<keyword>" --domain <domain> [-n <max_results>]
```

## Core Workflow

1. **Analyze Requirements** - Extract product type, style keywords, industry, and tech stack
2. **Search Domains** - Query relevant domains (product, style, typography, color, landing, chart, ux, stack)
3. **Synthesize** - Combine search results to create complete design system
4. **Implement** - Generate code with proper colors, fonts, spacing, and best practices

## Search Domains

| Domain | Use For | Example Keywords |
|--------|---------|------------------|
| `product` | Product type recommendations | SaaS, e-commerce, portfolio, healthcare, beauty |
| `style` | UI styles, colors, effects | glassmorphism, minimalism, dark mode, brutalism |
| `typography` | Font pairings, Google Fonts | elegant, playful, professional, modern |
| `color` | Color palettes by product type | saas, ecommerce, healthcare, beauty, fintech |
| `landing` | Page structure, CTA strategies | hero, hero-centric, testimonial, pricing |
| `chart` | Chart types, library recommendations | trend, comparison, timeline, funnel, pie |
| `ux` | Best practices, anti-patterns | animation, accessibility, z-index, loading |
| `stack` | Stack-specific guidelines | html-tailwind (default), react, nextjs, vue |

## Stack Support

Default to `html-tailwind` if not specified. Available: `html-tailwind`, `react`, `nextjs`, `vue`, `svelte`, `swiftui`, `react-native`, `flutter`

## Critical UI Rules

- **No emoji icons** - Use SVG icons (Heroicons, Lucide, Simple Icons)
- **Cursor pointer** - Add to all clickable elements
- **Light mode contrast** - Use `bg-white/80+` for glass cards, `#0F172A` for text
- **Hover feedback** - Provide visual feedback without layout shift
- **Floating elements** - Add spacing from edges (`top-4 left-4 right-4`)

See `references/usage-guide.md` for complete workflow and examples.
