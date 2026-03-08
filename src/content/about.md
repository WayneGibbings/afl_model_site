# How Does This Model Work?

## Overview

This model uses a two-layer forecasting system.

Layer 1 is an Elo ratings engine that estimates each team's underlying strength.
Layer 2 is an XGBoost regression model that combines those Elo ratings with match-level context to produce a predicted margin and win probability.

The goal is to produce independent, repeatable AFL forecasts that can be benchmarked against the Squiggle tipping ecosystem.

## Layer 1: Elo Ratings

The first layer is based on the Elo rating system, originally developed for chess and adapted here for AFL.

- Every team starts from a baseline rating of 1500.
- Ratings increase after wins and decrease after losses.
- Rating movement is opponent-aware, so beating a stronger side is worth more than beating a weaker side.

Key tuning parameters in this implementation are:

- **Venue-specific home ground advantage**: instead of one flat home advantage term, the model adjusts for venue familiarity and travel burden. This follows the spirit of Ryall & Bedford (2010), where venue effects materially improve forecasting quality in AFL.
- **Margin of victory multiplier**: larger wins matter more than narrow wins, but with diminishing returns so extreme scorelines do not dominate rating updates.
- **Inter-season decay**: ratings partially regress toward the mean between seasons to reflect list turnover, coaching change, and higher uncertainty at the start of a new year.

The 2020 season is excluded from parameter optimisation due to COVID-era structural anomalies (neutral venues, crowd restrictions, and schedule disruptions).

## Layer 2: XGBoost Model

The second layer is an XGBoost regression model that predicts margin.

Inputs include:

- Elo ratings for both teams from Layer 1.
- Rolling, team-aggregated match statistics such as contested possessions differential, inside 50s, clearances, and I50/R50 efficiency.
- Completed rounds as a signal for information maturity. Early in the season, form and statistical features tend to carry more signal while Elo is still stabilising. Later in the season, Elo typically becomes more reliable and the model can weight it more heavily.

Training uses temporal cross-validation to avoid look-ahead bias.
The model output is predicted margin, and win probability is derived from that margin via a calibrated logistic transform.

## What's Deliberately Excluded

Some inputs were intentionally left out in MVP:

- **Bookmaker odds**: excluded to preserve model independence. Using odds as a feature would mostly proxy the betting market instead of testing genuine forecasting capability.
- **Individual player statistics**: team-level aggregates are more robust and available earlier; player-level inputs are highly sensitive to late team-sheet changes.
- **Weather data**: tested, but noisy with low marginal predictive lift relative to model complexity.

## Performance Targets

- Mean Absolute Error (MAE) below 28 points.
- Tipping accuracy above 67%.
- Ongoing benchmarking against the Squiggle tipping leaderboard.

## Feature Glossary

All features are computed from the home team's perspective (positive = home team advantage).
EWMA features use a half-life of 5 games, computed strictly from games **prior** to the current match (no data leakage).

### Elo Features

| Feature | Description |
|---------|-------------|
| `elo_home` | Home team's Elo rating before the match. Initialised at 1500; decays 55% toward the mean (1500) between seasons. Updated each game using a margin-of-victory weighted K-factor (28 regular season, 36 finals). |
| `elo_away` | Away team's Elo rating before the match. Same system as `elo_home`. |
| `elo_diff` | `elo_home − elo_away`. A direct measure of relative team strength entering the match. Zero means evenly matched; positive means the home team is rated higher. |
| `venue_hga` | Home ground advantage applied at this venue for this match, in Elo points. Derived from the Elo system's `applied_hga` field. Default 20 points when unknown. |

### Form Features

All form features are **differentials** (home − away) of EWMA signals with a 5-game half-life.

| Feature | Description |
|---------|-------------|
| `form_margin_last5` | Differential of each team's EWMA scoring margin per game. Positive means the home team has been winning by larger margins recently. |
| `form_win_pct_last5` | Differential of each team's EWMA win rate (1.0 = win, 0.5 = draw, 0.0 = loss). Positive means the home team has been winning more frequently. |

### Game Style Features

Differentials (home − away) of EWMA game-style statistics.

| Feature | Description |
|---------|-------------|
| `rolling_pct_diff` | Differential of each team's EWMA kicking efficiency: `goals / (goals + behinds)`. Measures scoring accuracy. |
| `i50_diff` | Differential of each team's EWMA inside-50s per game. Measures how often teams are entering the forward 50. |
| `r50_efficiency` | Differential of each team's EWMA rebound-50 efficiency: `rebound_50s / inside_50s`. Measures defensive conversion of opposition forward entries. |
| `contested_possession_diff` | Differential of each team's EWMA contested possessions per game. Measures physical dominance at the contest. |

### Contextual Features

| Feature | Description |
|---------|-------------|
| `days_rest_diff` | `home_days_rest − away_days_rest`. Positive means the home team has had more recovery time. Default 7 days for the first game of the season. |
| `completed_rounds` | Number of rounds the home team has completed before this match (i.e. `round_number − 1`). Acts as a season-progress proxy; early-season features are less reliable due to small sample sizes. |

### Target Variable

| Column | Description |
|--------|-------------|
| `home_margin` | Final score margin from the home team's perspective (`home_score − away_score`). This is what the model predicts; win probability is derived from the predicted margin via a calibrated sigmoid. |

---

## Acknowledgements

- Squiggle community and API.
- Ryall, R. & Bedford, A. (2010). *An optimized ratings-based model for forecasting Australian Rules football*. International Journal of Forecasting, 26(3), 511-517.
- Betfair AFL modelling tutorial series.

## Two-Layer Flow

```text
Historical match data
        │
        ▼
  ┌─────────────┐
  │  Layer 1:   │
  │  Elo Engine │
  └──────┬──────┘
         │ Elo ratings
         ▼
  ┌─────────────────┐     Rolling match stats
  │    Layer 2:     │◄──── (contested possessions,
  │    XGBoost      │      inside 50s, clearances,
  │                 │      efficiency metrics)
  └──────┬──────────┘
         │
         ▼
  Predicted margin
  Win probability
```
