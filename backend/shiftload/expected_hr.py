"""Expected heart rate given recent steps.

The spec's model is a LightGBM regressor trained on consumer Fitbit minute
data. That training has not been run yet, so this module ships a hand-set
linear-in-lags prior. It is NOT trained and has no measured accuracy; the UI
labels it. Swap `load_model` to return the trained model when it exists.
"""
from dataclasses import dataclass

import numpy as np


@dataclass
class ExpectedHRModel:
    name: str = "untrained prior"
    trained: bool = False
    intercept: float = 5.0        # bpm above resting while awake and still
    slope: float = 0.30           # bpm per step/min, averaged over 3 min
    cap: float = 70.0
    # per-nurse calibration on top of the population prediction
    nurse_intercept: float = 0.0
    nurse_slope: float = 1.0

    def predict_excess(self, steps: np.ndarray) -> np.ndarray:
        """Expected HR minus resting HR for each minute."""
        steps = np.asarray(steps, dtype=float)
        padded = np.concatenate([np.zeros(2), steps])
        mean3 = (padded[2:] + padded[1:-1] + padded[:-2]) / 3.0
        pop = np.minimum(self.intercept + self.slope * mean3, self.cap)
        return self.nurse_intercept + self.nurse_slope * pop


def load_model(calibration: dict | None = None) -> ExpectedHRModel:
    model = ExpectedHRModel()
    if calibration:
        model.nurse_intercept = float(calibration.get("intercept", 0.0))
        model.nurse_slope = float(calibration.get("slope", 1.0))
    return model
