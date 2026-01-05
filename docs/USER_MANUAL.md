# User Manual: FIRE Wealth Optimiser

## Introduction
The **FIRE Wealth Optimiser** is a powerful tool designed to help you plan your financial future. It allows you to:
1.  **Model your current financial position** (Assets, Structures, Income, Expenses).
2.  **Optimize your investment strategy** using advanced mathematical models (Efficient Frontier).
3.  **Project your wealth** over time using Monte Carlo simulations to understand the range of possible outcomes.
4.  **Generate professional PDF reports** of your strategy.

## Getting Started
To access the application, navigate to the provided URL in your web browser. No login is currently required to use the basic features.

## Step-by-Step Guide

### 1. Data Input
The **Data** tab is where you configure your financial model.

*   **Asset Assumptions**: Define the expected return, risk (standard deviation), and tax characteristics for various asset classes (e.g., Australian Equities, US Tech, Bonds). You can toggle assets on/off or add custom ones.
*   **Entity Structures**: Input your current wealth distributed across different entities (Personal Name, Family Trust, Super Fund). This is crucial for accurate tax modeling.
*   **Cashflows**:
    *   **Income Streams**: Add salaries, business income, etc., with start and end years.
    *   **Expense Streams**: Add living expenses, school fees, etc.
    *   **One-Off Events**: Add major future capital events like "Downsize Home" (positive value) or "Gift to Children" (negative value).
*   **Parameters**: Set the **Projection Years** (e.g., 30 years) and **Inflation Rate**.

### 2. Running Optimization
Once your data is entered, switch to the **Optimization** tab.

1.  Click the **Run Optimization** button.
2.  The system will run thousands of simulations to find the best possible combinations of assets (portfolios) that maximize return for a given level of risk.
3.  **Efficient Frontier Chart**: The curve represents the "best" portfolios.
4.  **Select a Model**: Click on points along the curve (Model 1 to 10) to see the specific asset allocation for that risk level.
5.  **Portfolio Stats**: Review the Expected Return, Risk, and Sharpe Ratio for the selected model.

### 3. Wealth Projection
Switch to the **Cashflow** tab to see the long-term impact of your selected strategy.

*   **Monte Carlo Simulation**: The chart shows a "cone" of possibilities.
    *   **Median (50th percentile)**: The most likely outcome.
    *   **Top 10% / Bottom 10%**: Optimistic and pessimistic scenarios.
*   This helps you answer questions like: *"Will I run out of money if markets perform poorly?"*

### 4. Scenario Management
You can save different strategies to compare them.

*   **Save**: Enter a name in the "Scenario Name" box (top right) and click the **Save** icon.
*   **Load**: Click the **Folder** icon to see a list of saved scenarios. Click one to load it.
*   **Delete**: Click the trash icon next to a scenario in the load menu to remove it.

### 5. Reporting
To share or keep a record of your strategy:

1.  Ensure you have run the optimization and are happy with the selected model.
2.  Click the **PDF** icon (top right).
3.  The system will generate a comprehensive **Wealth Strategy Report** including:
    *   Key Assumptions
    *   Target Asset Allocation (Pie Chart & Table)
    *   Portfolio Analysis
    *   Efficient Frontier & Wealth Projection Charts
4.  The PDF will automatically download to your device.

## Troubleshooting

*   **"Please select at least 2 active assets"**: You need to have at least two asset classes enabled in the Data tab to run an optimization.
*   **PDF not generating**: Ensure you are not switching tabs while the PDF is being created. It may take a few seconds to capture the charts.
*   **Calculations look wrong**: Double-check your **Entity Structures** and **Tax Rates**. The model applies tax based on the entity type (e.g., Super funds pay less tax than Personal entities).
