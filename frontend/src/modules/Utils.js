import * as constants from './Constants';

export default class Utils {

    static nameDict = {
        test: 'fomratTest'
    }

    static getVarDisplayName(varName){
        var name;
        if(varName in this.nameDict){
            name = this.nameDict[varName]
        } else{
            name = this.unPythonCase(varName);
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

    static max(a,b){
        return (a >= b)? a:b;
    }

    static isTumor(organName){
        var gtvRegex = RegExp('GTV*');
        return gtvRegex.test(organName);
    }
    static min(a,b){
        return (a <= b)? a:b;
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

    static moveTTip(tTip, tipX, tipY){
        var tipBBox = tTip.node().getBoundingClientRect();
        if(tipBBox.width + tipX > window.innerWidth){
            tipX = tipX - 10 - tipBBox.width;
        }
        if(tipBBox.height + tipY > window.innerHeight){
            tipY = tipY- 10 - tipBBox.height;
        }
        tTip.style('left', tipX + 'px')
            .style('top', tipY + 'px')
            .style('visibility', 'visible')
            .style('z-index', 1000);
    }

    static moveTTipEvent(tTip, event){
        var tipX = event.pageX + 10;
        var tipY = event.pageY + 10;
        this.moveTTips(tTip,tipX,tipY);
    }

    
    static hideTTip(tTip){
        tTip.style('visibility', 'hidden')
    }

}