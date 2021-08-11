import numpy as np

def local_tssim(x,y,v = None, w = None):
    #calculates local similarity within two numpy arrays
    #ignores structure of the windows
    #x, y are base variables (distances) for patients 1 and 2
    #v and w are volumes for patients 1 and 2
    #should all be 1-dimensional for original intended use
    c1 = .000001
    c2  = .000001
    x = x
    y = y
    mean_x = np.mean(x)
    mean_y = np.mean(y)
    covariance = np.cov(x,y)
    numerator = (2*mean_x*mean_y + c1) * (covariance[0,1] + covariance[1,0] + c2)
    denominator = (mean_x**2 + mean_y**2 + c1)*(np.var(x) + np.var(y) + c2)
    if v is not None and w is not None:
        mean_v = np.mean(v)
        mean_w = np.mean(w)
        numerator *= (2*mean_v*mean_w + c1)
        denominator *= (mean_v**2 + mean_w**2 + c1)
    if denominator > 0:
        return numerator/denominator
    else:
        print('error, zero denomiator in ssim function')
        return 0
    
def jaccard_distance(x, y):
    numerator = x.dot(y)
    denominator = x.dot(x) + y.dot(y) - x.dot(y)
    if numerator == 0 or denominator == 0:
        return 0
    return numerator/denominator