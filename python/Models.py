import numpy as np
from abc import ABC, abstractmethod
import Utils
from multiprocessing import Pool, cpu_count
import os
import Metrics

def pairwise_similarity_job(model, p1, p2):
    similarity = model.pairwise_similarity(p1,p2)
    return p1, p2, similarity

class Similarity(ABC):
    #generic class for getting a similarity matrix
    def __init__(self,
                 #if the similarity matrix should be scaled from 0 to 1
                 normalize = True,
                 #if it should print out the results as it's running
                 update_progress = True,
                 #if > 1, will try to use multithreading with max n_jobs processes
                 n_jobs = 1
                ):
        self.normalize = normalize
        self.update_progress = update_progress
        self.n_jobs = n_jobs
        self.x_items = 0
        
    @abstractmethod
    def pairwise_similarity(self,p1, p2):
        #should take two indices for the patients
        #other things should be things from fit_data
        pass
    
    @abstractmethod
    def fit_data(self, distances,volumes):
        #this is called before pairwise similary, store necessary data structures here
        #should include setting self.x_items to number of patients
        #data dict is like {key: formatted_array, key: formatted_array...}
        pass
    
    def show_update(self,p1,p2,sim = None):
        #print out to console/notebook the current patients being read ing
        update_str = 'comparing patient ' + str(p1)
        update_str += ' and patient ' + str(p2)
        if sim is not None:
            update_str += ': ' + str(sim)
        #end = '\r' makes it replace the previous print out instead of appending a line
        print(update_str, end='\r')

    def get_similarity_matrix_singlethread(self):
        x_items = self.x_items
        similarity_array = np.zeros((x_items, x_items))
        for p1 in range(x_items):
            for p2 in range(p1 + 1, x_items):
                sim = self.pairwise_similarity(p1, p2)
                similarity_array[p1,p2] = sim
                if self.update_progress:
                    self.show_update(p1,p2,sim)
        return similarity_array
    
    def get_similarity_matrix_multithread(self):
        x_items = self.x_items
        similarity_array = np.zeros((x_items, x_items))
        #this part only seems to work on linux
        try:
            available_cpus = len(os.sched_getaffinity(0))
        except:
            available_cpus = cpu_count() - 2
        n_jobs = max(min(self.n_jobs, available_cpus), 1)
        with Pool(n_jobs) as pool:
            for p1 in range(x_items):
                #call all similarity for the given patient in a multithreaded process
                #can be in outer loop, but has given timeout issues there
                score_results = []
                for p2 in range(p1 + 1, x_items):
                    #call async functions for all similarities
                    score_result = pool.apply_async(pairwise_similarity_job,
                                                   args = (self,p1,p2))
                    score_results.append(score_result)
                for res in score_results:
                    #will time out after 10,000 seconds, may give an error
                    (p1,p2,sim) = res.get(1000)
                    similarity_array[p1,p2] = sim
                    if self.update_progress:
                        self.show_update(p1,p2,sim)
        return similarity_array
    
    def condense_matrix(self, m):
        #converts a similarity/distance matrix to condensed form
        #for scipy stuff, it should be converted to a distance matrix first
        pdist = []
        for i in range(m.shape[0]):
            for ii in range(i+1, m.shape[0]):
                pdist.append(m[i,ii])
        return np.array(pdist)
    
    def sim_to_dist(self,m):
        m = (m - m.min())/(m.max() - m.min())
        return 1-m
    
    def sim_to_pdist(self,sim):
        return self.condense_matrix(self.sim_to_dist(sim))
    
    def get_similarity_matrix(self, distances, volumes=None, multithread = True, condensed = False):
        self.fit_data(distances,volumes)
        assert(self.x_items > 1)
        if self.n_jobs > 1 and multithread:
            try:
                sim = self.get_similarity_matrix_multithread()
            except Exception as e:
                print(e)
                sim = self.get_similarity_matrix_singlethread()
        else:
            sim = self.get_similarity_matrix_singlethread()
        sim += sim.transpose()
        if self.normalize:
            sim = .99*Utils.minmax_scale(sim)
        np.fill_diagonal(sim, 1)
        if condensed:
            return self.condense_matrix(sim)
        return sim
     
class TssimSimilarity(Similarity):
    
    def get_adjacency_list(self, dist_array, window_size = 50, gtvname = "GTV"):
        #takes distance array (n_patients) x (n_organs + gtv) x (n_organs)
        #specific dimensions are flexible but the above is the format I'm writting it for
        #returns a list of (n_organs + gtv) arrays with the indeces of organs withing window_size distance
        mean_dists = np.nanmean(dist_array,axis=0)
        adjacency_list = []
        for organ_row in mean_dists:
            #gets indeces for organs within a certian distance
            #will index like dist_array[:,organ_row_idx,adjacent_organs]
            adjacent_organs = np.argwhere(organ_row < window_size)
            adjacency_list.append(adjacent_organs.ravel())
        return adjacency_list
    
    def pairwise_similarity(self, p1, p2):
        sims = np.empty((len(self.adjacency_list),))
        for i, adjacency in enumerate(self.adjacency_list):
            d1 =  self.dists[p1]
            d2 = self.dists[p2]
            if self.vols is not None:
                v1 = self.vols[p1]
                v2 = self.vols[p2]
            else:
                v1 = None,
                v2 =None
            sim = Metrics.local_tssim(d1,d2,v1,v2)
            sims[i] = sim
        return np.nanmean(sims)
    
    def fit_data(self, distances, volumes):
        self.dists = distances#data_dict['distances']
        self.vols = volumes#data_dict['volume']
        self.adjacency_list = self.get_adjacency_list(self.dists)
        self.x_items = self.dists.shape[0]

class PatientKNN():

    #class that takes a similarity array and returns a list of indexes for the knn of each patients
    def __init__(self, 
                 match_threshold = .98, 
                 match_type = 'threshold', 
                 n_match_bounds = [1,10],
                 default_n_matches = None
                ):
        #match type is how the number of matches are selected
        #give clusters to make it based on the class.
        #gives bounds on the number of knns to return
   
        self.n_match_bounds = n_match_bounds
        #similarity needed to be a match
        self.match_threshold = match_threshold
        self.default_n_matches = default_n_matches
        if default_n_matches is None:
            self.default_n_matches = int(np.mean(n_match_bounds))
        self.match_type = match_type
        return

    def get_matches(self, similarity_matrix):
        matches = []
        #normalize it so self-similarity is 1
        sim = similarity_matrix / similarity_matrix[0,0]
        for p in range( similarity_matrix.shape[0] ):
            patient_matches = self.get_patient_matches(p, sim[p])
            matches.append(patient_matches)
        return matches
    
    def get_patient_matches(self, p_idx, sim_scores):
        num_matches = self.get_num_matches(p_idx, sim_scores)
        args = np.argsort(-sim_scores)
        #start at 
        args = args[1:num_matches + 1] 
        return args
    
    def get_num_matches(self, p, score_vector):
        #for later better use probs
        if self.match_type == 'threshold':
            good_matches= len(np.where(score_vector > self.match_threshold)[0])
            matches = min(max([self.n_match_bounds[0], good_matches]),self.n_match_bounds[1])
        else:
            matches = self.default_n_matches
        return matches


                 