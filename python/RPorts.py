import rpy2
from rpy2.robjects import FloatVector
from rpy2.robjects.packages import importr
import pandas as pd
import numpy as np
import Metrics
import Utils

rstats = importr('stats')

def r_fisher_exact(x,y,
                   simulate=False,
                   alternative='two_sided',
                   workspace=2e8,
                  ):
    x = FloatVector(x)
    y = FloatVector(x)
    res = rstats.fisher_test(x,y,
                             simulate_p_value=simulate,
                             workspace=workspace,
                             alternative=alternative,
                             B=4000,
                            )
    return res[0]