from scipy.spatial.distance import squareform
from scipy.cluster.hierarchy import fcluster, linkage
from sklearn.base import ClusterMixin, BaseEstimator
from sklearn.metrics import silhouette_score
import numpy as np

class SimilarityClusterer(ClusterMixin, BaseEstimator):
    #class the clusters using agglomerative clustering based on precomputed distances
    def __init__(self, n_clusters, link = 'ward', criterion = 'maxclust'):
        self.link = link
        self.t = n_clusters
        self.criterion = criterion
        self.fit_sim = None
        self.fit_clusters = None
        
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
        clusters = fcluster(l, self.t, criterion = self.criterion)
        self.fit_sim = x
        self.fit_clusters = clusters
        return clusters
    
    def silhouette(self):
        if type(self.fit_sim) == type(None) or type(self.fit_clusters) == type(None):
            print('trying to get sihouette score for unfitted clustering')
        d = 1/(1+self.fit_sim)
        return silhouette_score(d,self.fit_clusters, metric='precomputed')
    
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
    
    def brief(self):
        return 'simclust_' + str(self.link) + '_' + str(self.t) + '_' + str(self.criterion)