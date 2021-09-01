import * as constants from './Constants';

export default class Utils {

    static nameDict = {
        cvap: 'Population',
        urm_pct: 'Black/Hispanic (%)',
        female_pct: 'Female (%)',
        net_dem_president_votes: 'Net Dem. Votes (2016)',
        is_blue: 'Voted Democrat (2016)',
        median_hh_income: 'Median Income ($)',
        lesscollege_pct: 'Education < Some College (%)',
        lesshs_pct: 'Education < HighSchool (%)',
        repgov: 'Net Votes for Republican Governer',
        clf_unemploy_pct: 'Unemployment (%)',
        mask_score: 'Self-Reported Mask Use (1-5)',
        rural_urban_cc: 'Rural-Urban Continum Code',
        cases_per_capita: 'Covid Cases (%)',
        cases_per_captia_discrete: 'Covid Cases (Rank)',
        deaths_per_capita: 'Covid Deaths (%)',
        retweet_count: '# Retweets',
        retweet_count_discrete: 'Retweets (Rank)',
        is_vivid: 'Vivid',
        tweetSentiment: 'sentiment',
        qualityRatio: 'vividness',
        tweetFrameVote: 'pol. party',
        againstSah: 'RTs (-SAH)',
        forSah: 'RTs (+SAH)',
        positiveSentiment: 'Pos.',
        negativeSentiment: 'Neg.',
        neutralSentiment: 'None',
        blueState: 'Dem.',
        redState: 'Rep.',
        vividQuality: 'Vivid',
        genericQuality: 'Generic'
    }

    static getVarDisplayName(varName, valueLabel){
        var name;
        if(varName in this.nameDict){
            name = this.nameDict[varName]
        } else{
            name = this.unPythonCase(varName);
        }
        if(valueLabel !== undefined){
            name = (valueLabel > 0)? name:'Not '+ name;
        }
        return name;
    }

    static signedLog(x){
        if(Math.abs(x) < 1){
            return x
        }
        return Math.sign(x)*Math.log(Math.abs(x));
    }

    static sum(arr){
        let total = 0;
        for(var val of arr){
            total += val;
        }
        return total
    }

    static extents(arr){
        let maxVal = arr[0];
        let minVal = arr[0];
        for(const value of arr){
            maxVal = Math.max(maxVal, value);
            minVal = Math.min(minVal, value)
        }
        return {min: minVal, max: maxVal}
    }

    static mean(arr){
        let total = 0;
        for(var val of arr){
            total += val;
        }
        return total/arr.length
    }

    static median(arr){
        let sortedArray = arr.slice();
        sortedArray.sort();
        if(sortedArray.length === 1){
            return sortedArray[0]
        }
        else if(sortedArray.length%2 !== 0){
            return sortedArray[parseInt(sortedArray.length/2)]
        } else{
            let lower = parseInt(sortedArray.length/2);
            return (sortedArray[lower] + sortedArray[lower+1])/2
        }
    }

    static numberWithCommas(x){

        //from https://stackoverflow.com/a/2901298
        //should add commas to a number in thousands place?
        return x.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
    }

    static emptyObject(obj){
        //checks if something is == {}, bascially
        try{
            var flag = (obj.constructor === Object && Object.keys(obj).length === 0);
            return flag
        } catch{
            return false
        }
    }

    static itemInArray(item, targetArray){
        for(let target of targetArray){
            if(item === target){
                return true
            }
        }
        return false
    }

    static arrayUnions(...arrays){
        //should, in theory, join a list of arrays.  May not work
        var newArray = [];
        if(arrays.length === 1){
            return arrays[0];
        }
        for(var arr in arrays){
            newArray.concat( arr[1].filter(x => (!newArray.includes(x)) ));
        }
        return newArray
    }

    static isObject(item) {
        return (item && typeof item === 'object' && !Array.isArray(item));
    }

    static unCamelCase(string){
        //converts camelCase to Camel Case.  For like, showing names
        //taken from https://stackoverflow.com/a/6229124
        try{
            var newString = string.replace(/([a-z])([A-Z])/g, '$1 $2')  //insert spaces
                .replace(/\b([A-Z]+)([A-Z])([a-z])/, '$1 $2$3') //space before last upper in a sequence fellowed by lower
                .replace(/^./, function(str){ return str.toUpperCase(); });  //uppercase first character
            return newString
        }catch{
            return ''
        }
    }

    static unSnakeCase(string){
        //should convert snake-case to Snake Case.  untested. based on unCamelCase
        try{
            var newString = string.toLowerCase()
                .replace(/([a-z])-([a-z])/g, '$1 $2') 
                .replace(/^./, function(str){ return str.toUpperCase(); });
            return newString;
        } catch{
            return '';
        }
    }

    static unPythonCase(string){
        //should convert snake_case to Snake Case.  untested. based on unCamelCase
        try{
            var newString = string.toLowerCase()
                .replace(/([a-z])_([a-z])/g, '$1 $2') 
                .replace(/^./, function(str){ return str.toUpperCase(); });
            return newString;
        } catch{
            return string;
        }
    }

    static formatPercent(string){
        return Utils.unCamelCase(string+'PerCapita')
    }

    static markifiedLabelLookup(index, markArray){
        //take an array from markify and maps an index to a value, for the slider
        var entry = markArray.filter(d => d.value === index);
        entry = entry[0].label;
        return entry
    }

    static wrapError(func, error_string){
        try{
            func();
        } catch(err){
            console.log(error_string);
            console.log(err);
        }
    }

    static arrayEqual(a1, a2){
        if(a1.length !== a2.length){
            return false
        }
        for(let idx in a1){
            if(a1[idx] !== a2){
                return false
            }
        }
        return true
    }

    static arrange(start, stop, nSteps){
        let stepSize = (stop - start)/(nSteps-1);
        let vals = [];
        let currVal = start;
        while(currVal < stop){
            vals.push(currVal);
            currVal += stepSize;
        }
        vals.push(stop)
        return vals
    }

    static moveTTip(tTip, event){
        var tipBBox = tTip.node().getBoundingClientRect();
        var tipX = event.pageX + 10;
        var tipY = event.pageY + 10;
        if(tipBBox.width + tipX > window.innerWidth){
            tipX = event.pageX - 10 - tipBBox.width;
        }
        if(tipBBox.height + tipY > window.innerHeight){
            tipY = event.pageY - 10 - tipBBox.height;
        }
        tTip.style('left', tipX + 'px')
            .style('top', tipY + 'px')
            .style('visibility', 'visible');
    }
    
    static hideTTip(tTip){
        tTip.style('visibility', 'hidden')
    }

    static formatText(text){
        if(text.includes('cases')){
            return (text.includes('per_capita')? 'Cases/Capita':'Cases');
        } 
        if(text.includes('deaths')){
            return (text.includes('per_capita')? 'Deaths/Capita':'Deaths');
        }
        if(text.includes('retweet') || text.includes('rt_discrete')){
            return 'retweets';
        }
        if(text === 'cvap'){
            return 'Population'
        }
        if(text === 'is_blue'){
            return 'Voted Dem in 2016 (y/n)'
        }
    }
}