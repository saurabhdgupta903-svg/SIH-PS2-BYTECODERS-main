# SHELTER-X / ThermoShelter Designer

**SHELTER-X / ThermoShelter Designer** is an advanced, physics-grounded thermal decision-support tool for passive shelter design in extreme climates. Originally developed for **Smart India Hackathon (PS 26051: Area-Specific Shelter for Thermal Comfort)**, it specifically addresses harsh high-altitude cold desert regions (such as Ladakh) while maintaining full global applicability for any geographic location worldwide.

---

## Key Features

- **Global Geocoding & Real-Time Weather**: Search any city or coordinate worldwide (e.g. Leh, Shimla, Phoenix, Tokyo) with OpenStreetMap Nominatim geocoding and live 24-hour diurnal ambient temperature and solar irradiance from Open-Meteo and NASA POWER API with automatic offline physical fallback.
- **Physics-Grounded Thermal Simulation Engine**:
  - Full lumped-capacitance explicit Euler numerical integration across all 10 governing thermodynamic formulas (solar gain, glazing transmittance, multi-layer wall/roof U-values, envelope conduction, infiltration, nocturnal sky radiation, and thermal mass capacitance).
  - Daily steady-cycle cyclic convergence engine checking convergence to within 0.01 °C residual.
- **Three Required Thermal Outputs Highlighted**:
  1. **Predicted Indoor Temperature**: 24-hour diurnal profile with mean, peak, minimum, and thermal damping percentage.
  2. **Solar Thermal Energy Generated**: Daily total solar energy absorbed in kWh and Wh, along with peak generation watts.
  3. **Heat Flow Over 24h Period**: Comprehensive heat loss through walls, roof, infiltration, and sky radiation, detailing ambient vs. shelter temperature differentials ($\Delta T$).
- **Parametric 3D Shelter Visualizer (Three.js)**:
  - Interactive 3D wireframe and solid representation with real-time temperature-tinted shader rendering.
  - Dynamic 3D heat-flow arrows displaying solar gain vectors and envelope heat losses.
  - Scrubbable 24-hour diurnal playback with orbit, pan, zoom, camera presets, and GPU resource memory cleanup.
- **Design Recommender & Optimization**:
  - Multi-objective search grid over local regional materials (rammed earth, mud brick, stone masonry, wood, insulation).
  - Automatically identifies Pareto-optimal configurations to keep warm, keep cool, or minimize diurnal swing.
- **Sensitivity Analysis**:
  - Tornado sensitivity rankings across envelope geometry, layer thicknesses, infiltration rates, and film coefficients.
- **Comprehensive Report Generation**:
  - One-click print / PDF export formatted with full material assemblies, ambient climate parameters, and thermal metrics.

---

## Color Palette System

The user interface uses the dark violet-tinted theme palette:

| Element | Color Hex | Role |
| :--- | :--- | :--- |
| **Violet** | `#5003C0` | Primary interactive elements, active navigation states, link accents |
| **Magenta** | `#AB03A9` | Secondary accents, section highlights, and brand gradients |
| **Pink-Red** | `#FF467A` | Heat metrics, warnings, primary CTA buttons, predicted indoor temperature curves |
| **Yellow** | `#FFD51E` | Solar energy highlights, badges, ambient temperature curves, solar heat flow |
| **Page Surface** | `#0D0620` | Main application background |
| **Card Surface** | `#160B30` | Content containers, cards, and modal backdrops |
| **Raised Surface** | `#1F1240` | Inputs, dropdown menus, table headers, and hover surfaces |
| **Borders** | `#2E195E` / `rgba(80, 3, 192, 0.35)` | Clean, non-intrusive container outlines |
| **Text Primary** | `#F4EFFF` | High-contrast body text and headers |
| **Text Secondary**| `#B9AEDB` | Subheadings, metadata labels, and helper descriptions |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+ recommended)
- [npm](https://www.npmjs.com/)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/SIH-PS2-BYTECODERS.git

# Navigate into project directory
cd SIH-PS2-BYTECODERS-main

# Install dependencies
npm install
```

### Environment Configuration

Copy the example environment configuration:

```bash
cp .env.example .env
```

*(Note: Geocoding and real-time weather utilize open services without mandatory keys. If you configure a custom weather provider, add `VITE_WEATHER_API_KEY` to `.env`).*

### Running the Application

```bash
# Start local development server (Vite)
npm run dev
```

Visit `http://localhost:5173` in your browser.

### Building for Production

```bash
# Typecheck and compile production bundle
npm run build

# Preview production build locally
npm run preview
```

### Running Tests and Linting

```bash
# Run unit tests for thermal engine and steady-cycle simulation
npm test

# Run 3-location global weather & simulation verification (Leh, Shimla, Phoenix)
node --experimental-strip-types src/test_locations.test.ts

# Run fast linter across all source files
npm run lint
```

---

## Project Structure

```
├── src/
│   ├── components/
│   │   ├── advanced/       # Climate table, multi-layer wall/roof editor, geocoding search
│   │   ├── common/         # NumberInput with zero/NaN guards, ModeToggle, Navigation
│   │   ├── compare/        # Multi-variant shelter comparison view
│   │   ├── layout/         # Header, Sidebar navigation, and responsive containers
│   │   ├── quick/          # Geometry sliders, preset picker, quick material picker
│   │   ├── recommender/    # Optimization and design recommendation engine
│   │   ├── report/         # Printable technical report view
│   │   ├── results/        # ResultsView displaying the 3 core thermal metrics & charts
│   │   ├── review/         # Modal review for all shelter parameters
│   │   ├── sensitivity/    # Parameter sensitivity and tornado chart view
│   │   └── visualization/  # Parametric Three.js 3D shelter viewer with leak-free disposal
│   ├── context/            # Shared ShelterContext state management
│   ├── data/               # Regional presets (Ladakh, etc.) & default material libraries
│   ├── lib/
│   │   ├── climateApi.ts   # OpenStreetMap geocoding, Open-Meteo, NASA POWER & fallback
│   │   ├── thermalEngine.ts# Core 10 thermodynamic equations
│   │   └── simulateSteadyCycle.ts # Multi-day cyclic convergence solver
│   └── types/              # TypeScript definitions for shelter geometry, materials, climate
├── tailwind.config.js      # Custom theme system with exact palette tokens
└── package.json
```

---

## Technical Specifications (Smart India Hackathon PS 26051)

1. **Solar Heat Gain**: $Q_{solar} = I \cdot A \cdot \tau \cdot \cos(\theta)$
2. **Glazing Absorbed Heat**: $Q_{abs} = Q_{solar} \cdot \alpha$
3. **Envelope U-Value**: $U = \frac{1}{\frac{1}{h_{in}} + \sum \frac{d_i}{k_i} + \frac{1}{h_{out}}}$
4. **Conductive Heat Loss**: $Q_{loss} = U \cdot A \cdot (T_{inside} - T_{ambient})$
5. **Infiltration Loss**: $Q_{inf} = \dot{V} \cdot \rho \cdot c_p \cdot (T_{inside} - T_{ambient})$
6. **Nocturnal Radiative Loss**: $Q_{rad} = \varepsilon \cdot \sigma \cdot A \cdot (T_{inside}^4 - T_{sky}^4)$
7. **Lumped Thermal Mass**: $C = \sum (m_i \cdot c_i)$
8. **Explicit Euler Integration**: $T_{t+\Delta t} = T_t + \frac{\Delta t}{C} \cdot \left(Q_{gain} - Q_{loss} - Q_{inf} - Q_{rad}\right)$
