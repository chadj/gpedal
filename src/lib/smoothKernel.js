/**
This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

// From https://bl.ocks.org/muonsw/3eb574d4b247fb4a484b
// Simon West - https://github.com/muonsw

/**
 * Gaussian kernel - applied within the smoothKernel function
 * @param {number} x1 - point being adjusted
 * @param {number} x2 - point used to make adjustment
 * @param {number} b - scaling parameter
 * @returns {number} result of expression
 */
function k_G(x1 , x2 , b ) {
    return (1/Math.sqrt(2*Math.PI))*Math.exp(-(Math.pow((x1 - x2),2) / (2*Math.pow(b,2))));
}

/**
 * Epanechnikov kernel - applied within the smoothKernel function
 * @param {number} x1 - point being adjusted
 * @param {number} x2 - point used to make adjustment
 * @param {number} b - scaling parameter
 * @returns {number} result of expression
 */
function k_E(x1 , x2 , b ) {
    if (Math.abs((x1 - x2) / b) > 1) {
        return 0;
    } else {
        return (3 / 4) * (1 - Math.pow(((x1 - x2) / b), 2));
    }
}

/**
 * Logistic kernel - applied within the smoothKernel function
 * @param {number} x1 - point being adjusted
 * @param {number} x2 - point used to make adjustment
 * @param {number} b - scaling parameter
 * @returns {number} result of expression
 */
function k_L(x1 , x2 , b ) {
    return 1 / (Math.exp((x1 - x2) / b) + Math.exp(-(x1 - x2) / b));
}

/**
 * Uniform kernel - applied within the smoothKernel function
 * @param {number} x1 - point being adjusted
 * @param {number} x2 - point used to make adjustment
 * @param {number} b - scaling parameter
 * @returns {number} result of expression
 */
function k_U(x1 , x2 , b ) {
    if (Math.abs((x1 - x2) / b) > 1) {
        return 0;
    } else {
        return 1 / 2;
    }
}

/**
 * Triangular kernel - applied within the smoothKernel function
 * @param {number} x1 - point being adjusted
 * @param {number} x2 - point used to make adjustment
 * @param {number} b - scaling parameter
 * @returns {number} result of expression
 */
function k_T(x1 , x2 , b ) {
    if (Math.abs((x1 - x2) / b) > 1) {
        return 0;
    } else {
        return (1 - Math.abs((x1 - x2) / b));
    }
}

/**
 * Quartic kernel - applied within the smoothKernel function
 * @param {number} x1 - point being adjusted
 * @param {number} x2 - point used to make adjustment
 * @param {number} b - scaling parameter
 * @returns {number} result of expression
 */
function k_Q(x1 , x2 , b ) {
    if (Math.abs((x1 - x2) / b) > 1) {
        return 0;
    } else {
        return (15 / 16) * Math.pow((1 - Math.pow(((x1 - x2) / b), 2)), 2);
    }
}

/**
 * Triweight kernel - applied within the smoothKernel function
 * @param {number} x1 - point being adjusted
 * @param {number} x2 - point used to make adjustment
 * @param {number} b - scaling parameter
 * @returns {number} result of expression
 */
function k_TW(x1 , x2 , b ) {
    if (Math.abs((x1 - x2) / b) > 1) {
        return 0;
    } else {
        return (35 / 32) * Math.pow((1 - Math.pow(((x1 - x2) / b), 2)), 3);
    }
}

/**
 * Cosine kernel - applied within the smoothKernel function
 * @param {number} x1 - point being adjusted
 * @param {number} x2 - point used to make adjustment
 * @param {number} b - scaling parameter
 * @returns {number} result of expression
 */
function k_Co(x1 , x2 , b) {
    if (Math.abs((x1 - x2) / b) > 1) {
        return 0;
    } else {
        return (Math.PI / 4) * Math.cos((Math.PI / 2) * ((x1 - x2) / b));
    }
}

/**
 * Tricube kernel - applied within the smoothKernel function
 * @param {number} x1 - point being adjusted
 * @param {number} x2 - point used to make adjustment
 * @param {number} b - scaling parameter
 * @returns {number} result of expression
 */
function k_TC(x1 , x2 , b) {
    if (Math.abs((x1 - x2) / b) > 1) {
        return 0;
    } else {
        return (70 / 81) * Math.pow((1 - Math.pow(Math.abs((x1 - x2) / b), 3)), 3);
    }
}

/**
 * Silverman kernel - applied within the smoothKernel function
 * @param {number} x1 - point being adjusted
 * @param {number} x2 - point used to make adjustment
 * @param {number} b - scaling parameter
 * @returns {number} result of expression
 */
function k_S(x1, x2, b){
    var u = Math.abs((x2-x1)/b);

    return 0.5 * Math.exp(-u/Math.SQRT2) * Math.sin(u/Math.SQRT2 + Math.PI/4);
}


/**
 * Take an array of points and returns a set of smoothed points by applying a filter (specified by the kernel function) to the data
 * This function cuts off the kernel calculations after the kernel decreases beyond a certain level
 * @returns {array} - an array with the new points
 */

export const ssci = {};
ssci.smooth = {};

ssci.smooth.kernel2 = function(){

    var output=[];
    var kernels = {
        'Uniform': k_U,
        'Triangle': k_T,
        'Epanechnikov': k_E,
        'Quartic': k_Q,
        'Triweight': k_TW,
        'Logistic': k_L,
        'Cosine': k_Co,
        'Gaussian': k_G,
        'Tricube': k_TC,
        'Silverman': k_S
    };
    var max_diff = 0.001;   //Maximum difference to calculate kernel - equivalent to 0.1%
    var scale = [];
    var data = [];
    var kernel = "Gaussian";
    var i, j;               //Iterators
    var x_conv = function(d){ return d[0]; };
    var y_conv = function(d){ return d[1]; };

    function sk() {
        var dataArray = [];

        //Create array of data using accessors
        dataArray = data.map( function(d){
            return [x_conv(d), y_conv(d)];
        });

        //Deal with scale
        var scales = [];

        if(typeof scale === 'number'){
            //Create an array of length dataArray and populate with scale parameter
            for(i=0;i<dataArray.length;i++){
                scales.push(scale);
            }
        } else if (typeof scale === 'object' && Array.isArray(scale)){
            //Does the length of the scale array match the number of points fed to the function
            if(scale.length === dataArray.length){
                scales = scale.slice();
            } else {
                //Put in for completeness but will almost never be what is intended
                var counter=0;
                for(i=0;i<dataArray.length;i++){
                    scales.push(scale[counter]);
                    if(i<scale.length){
                        counter++;
                    } else {
                        counter=0;
                    }
                }
            }
        } else {
            //What else can it be?
            console.log(scale);
            throw new Error('Invalid scale parameter');
        }

        //Calculate smoothed values
        for(i=0;i<dataArray.length;i++){
            var tot_ker1 = 0;
            var tot_ker2 = 0;
            var temp_ker = 0;

            //Kernel for point=i
            var self_ker = kernels[kernel](dataArray[i][0], dataArray[i][0], scales[i]);
            tot_ker1 = tot_ker1 + self_ker * dataArray[i][1];
            tot_ker2 = tot_ker2 + self_ker;

            //Kernel for lower points
            for(j=i-1; j>-1; j--){
                temp_ker = kernels[kernel](dataArray[i][0], dataArray[j][0], scales[i]);
                if(temp_ker/self_ker<max_diff){
                    break;
                }
                tot_ker1 = tot_ker1 + temp_ker * dataArray[j][1];
                tot_ker2 = tot_ker2 + temp_ker;
            }

            //Kernel for higher points
            for(j=i+1; j<dataArray.length; j++){
                temp_ker = kernels[kernel](dataArray[i][0], dataArray[j][0], scales[i]);
                if(temp_ker/self_ker<max_diff){
                    break;
                }
                tot_ker1 = tot_ker1 + temp_ker * dataArray[j][1];
                tot_ker2 = tot_ker2 + temp_ker;
            }

            output.push([dataArray[i][0],(tot_ker1 / tot_ker2)]);
        }
    }

    sk.scale = function(value){
        if(!arguments.length){ return scale; }
        scale = value;

        return sk;
    };

    sk.kernel = function(value){
        if(!arguments.length){ return kernel; }
        //Check that the kernel is valid
        if(typeof kernels[value] !== 'function'){
            throw new Error('Invalid kernel');
        }

        kernel = value;

        return sk;
    };

    sk.x = function(value){
        if(!arguments.length){ return x_conv; }
        x_conv = value;
        return sk;
    };

    sk.y = function(value){
        if(!arguments.length){ return y_conv; }
        y_conv = value;
        return sk;
    };

    sk.output = function(){
        return output;
    };

    sk.diff = function(value){
        if(!arguments.length){ return max_diff; }
        max_diff = value;

        return sk;
    };

    sk.data = function(value){
		data = value;

		return sk;
	};

    return sk;
};
