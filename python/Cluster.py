from scipy.spatial.distance import squareform
from scipy.cluster.hierarchy import fcluster, linkage
from sklearn.base import ClusterMixin, BaseEstimator
import numpy as np

class SimilarityClusterer(ClusterMixin, BaseEstimator):
    #class the clusters using agglomerative clustering based on precomputed distances
    def __init__(self, n_clusters, link = 'ward', criterion = 'maxclust'):
        self.link = link
        self.t = n_clusters
        self.criterion = criterion
        
    def sim_linkage(self,sim):
        x = self.sim_to_pdist(sim)
        l = linkage(x, method = self.link, optimal_ordering = True)
        return l
        
    def get_leaves(self, x):
        l = self.sim_linkages
        dendro = dendrogram(l)
        return np.array(dendro['leaves']).astype('int32')
    
    def fit_predict(self, x, y = None):
        l = self.sim_linkage(x)
        return fcluster(l, self.t, criterion = self.criterion)
    
    def sim_to_pdist(self,sim):
        sim = (sim - sim.min())/(sim.max() - sim.min())
        return self.condense(1-sim)

    def condense(self, m):
        #converts a similarity/distance matrix to condensed form
        #for scipy stuff, it should be converted to a distance matrix first
        pdist = []
        for i in range(m.shape[0]):
            for ii in range(i+1, m.shape[0]):
                pdist.append(m[i,ii])
        return np.array(pdist)