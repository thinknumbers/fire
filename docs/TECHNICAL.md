# Technical Documentation

## System Overview

The **FIRE Wealth Optimiser** is a Single Page Application (SPA) built with **React** and **Vite**. It is designed to help users model financial scenarios, optimize asset allocation using Efficient Frontier analysis, and project long-term wealth using Monte Carlo simulations.

The application uses **Supabase** as a Backend-as-a-Service (BaaS) for data persistence (saving/loading scenarios) and authentication (currently using anonymous keys for public access in this version).

## Technology Stack

### Frontend
*   **Framework**: React 18
*   **Build Tool**: Vite
*   **Language**: JavaScript (ES Modules)
*   **Styling**: Tailwind CSS
*   **Charting**: Recharts (Line, Scatter, Pie, Bar charts)
*   **Icons**: Lucide React
*   **PDF Generation**: jsPDF, html2canvas, svg2pdf.js

### Backend / Infrastructure
*   **Database**: Supabase (PostgreSQL)
*   **Hosting**: Vercel (configured via `vercel.json`)

## Database Schema

The application uses a single table `scenarios` in Supabase to store user-created financial models.

### Table: `scenarios`

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key, auto-generated. |
| `name` | `text` | Name of the scenario (e.g., "My Strategy"). |
| `created_at` | `timestamptz` | Timestamp of creation/update. |
| `assets` | `jsonb` | Array of asset objects (allocations, returns, etc.). |
| `structures` | `jsonb` | Array of entity structures (Personal, Trust, Super). |
| `income_streams` | `jsonb` | Array of income stream objects. |
| `expense_streams` | `jsonb` | Array of expense stream objects. |
| `one_off_events` | `jsonb` | Array of one-off financial events. |
| `projection_years` | `integer` | Number of years for the simulation. |
| `inflation_rate` | `float` | Inflation rate (decimal, e.g., 0.025 for 2.5%). |

## Environment Configuration

The application requires the following environment variables to be set in a `.env` file for local development or in the Vercel project settings for production.

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Deployment

### Vercel
The project is configured for deployment on Vercel.
*   **Configuration File**: `vercel.json`
*   **Build Command**: `npm run build` (or `vite build`)
*   **Output Directory**: `dist`

### Local Development
1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Start the development server:
    ```bash
    npm run dev
    ```
