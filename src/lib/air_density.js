/*
 * Air density calculator.
 *
 * Copyright 2012 by Steven Gribble (gribble [at] gmail (dot) com)
 * http://www.gribble.org/
 */

// Calculate the air density, given:
//  temp = temperature (celsius)
//  press = actual air pressure (millibars, i.e., hectopascals)
//  dew = dew point (celsius)
export function CalculateRho(temp, press, dew) {
    // Step 1: calculate the saturation water pressure at the dew point,
    // i.e., the vapor pressure in the air.  Use Herman Wobus' equation.
    var c0 = 0.99999683;
    var c1 = -0.90826951E-02;
    var c2 = 0.78736169E-04;
    var c3 = -0.61117958E-06;
    var c4 = 0.43884187E-08;
    var c5 = -0.29883885E-10;
    var c6 = 0.21874425E-12;
    var c7 = -0.17892321E-14;
    var c8 = 0.11112018E-16;
    var c9 = -0.30994571E-19;
    var p = c0 + dew*(c1 + dew*(c2 + dew*(c3 + dew*(c4 + dew*(c5 + dew*(c6 + dew*(c7 + dew*(c8 + dew*(c9)))))))));
    var psat_mbar = 6.1078 / (Math.pow(p, 8));

    // Step 2: calculate the vapor pressure.
    var pv_pascals = psat_mbar * 100.0;

    // Step 3: calculate the pressure of dry air, given the vapor
    // pressure and actual pressure.
    var pd_pascals = (press*100) - pv_pascals;

    // Step 4: calculate the air density, using the equation for
    // the density of a mixture of dry air and water vapor.
    var density =
        (pd_pascals / (287.0531 * (temp + 273.15))) +
        (pv_pascals / (461.4964 * (temp + 273.15)));

    return density;
}
