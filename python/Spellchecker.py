import pandas as pd
import numpy as np
from Levenshtein import distance as levenshtein_distance

class SpellChecker():
    
    def __init__(self, keywords, aliases, max_edit_distance = .15,normalize_score = True):
        self.keywords = keywords #list
        self.keywordset = set(keywords)
        self.aliases = aliases #dict 
        self.normalize_score = normalize_score
        self.positional_pairs = [('Lt','Rt'),('L_','R_'),('_L','_R')]
        self.max_edit_distance = max_edit_distance
            
    def word_distance(self,word1,word2):
        dist = 0
        #add an extra penalty if one is right and one is left
        for (x,y) in self.positional_pairs:
            if x in word1 and y in word2 or y in word1 and x in word2:
                dist += len(word1)
                break
        clean = lambda w: w.strip().lower().replace("_","")
        dist += levenshtein_distance(clean(word1),clean(word2))
        if self.normalize_score:
            dist = dist/max(len(str(word1)),len(str(word2)))
        return dist
        
    def best_spell_match(self,name,words):
        #compare a word with a list of words
        #get the closest word to source word based on edit distance
        best_match = None
        best_dist = np.inf
        for word in words:
            ld = self.word_distance(name,word)
            if ld < best_dist:
                best_dist = ld
                best_match = word
                if ld <= 0:
                    break
        return best_match, best_dist
    
    def spellcheck_df(self, df, cols=None,unique = True):
        df = df.copy()
        rename_dict = {}
        if cols is None:
            cols = list(df.columns)
            
        all_renames = {}
        for col in cols:
            df[col] = df[col].apply(lambda x: self.aliases.get(x.lower(),x))
            in_col = np.unique(df[col].values.astype('str'))
            matchwords = [i for i in self.keywords if i not in in_col]
            col_words = [w for w in in_col if w not in self.keywordset]
            if len(col_words) < 1:
                break
            rename_dict = {}
            for cword in col_words:
                match,dist = self.best_spell_match(cword,matchwords)
                if dist < self.max_edit_distance:
                    if match != cword:
                        rename_dict[cword] = match
                        all_renames[cword] = match
                else:
                    aliasmatch, alias_dist = self.best_spell_match(cword, list(self.aliases.keys()))
                    if alias_dist < self.max_edit_distance:
                        target = self.aliases[aliasmatch]
                        rename_dict[cword] = target
                        all_renames[cword] = target
            df[col] = df[col].apply(lambda x: rename_dict.get(x,x))
        return df,all_renames