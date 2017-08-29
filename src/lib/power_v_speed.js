/*
 * Cycling power vs. velocity, based on a physical model.
 *
 * Copyright 2012 by Steven Gribble (gribble [at] gmail (dot) com)
 * http://www.gribble.org/
 */

// Calculates and returns the force components needed to achieve the
// given velocity.  <params> is a dictionary containing the rider and
// environmental parameters all in metric units.  'velocity' is in km/h.
function CalculateForces(velocity, params) {
    // calculate Fgravity
    var Fgravity = 9.8067 *
        (params.rp_wr + params.rp_wb) *
        Math.sin(Math.atan(params.ep_g / 100.0));

    // calculate Frolling
    var Frolling = 9.8067 *
        (params.rp_wr + params.rp_wb) *
        Math.cos(Math.atan(params.ep_g / 100.0)) *
        (params.ep_crr);

    // calculate Fdrag
    var Fdrag = 0.5 *
        (params.rp_a) *
        (params.rp_cd) *
        (params.ep_rho) *
        (velocity * 1000.0 / 3600.0) *
        (velocity * 1000.0 / 3600.0);

    // cons up and return the force components
    var ret = { };
    ret.Fgravity = Fgravity;
    ret.Frolling = Frolling;
    ret.Fdrag = Fdrag;
    return ret;
}

// Calculates and returns the power needed to achieve the given
// velocity.  <params> is a dictionary containing the rider and
// environmenetal parameters all in metric units.  'velocity'
// is in km/h.  Returns power in watts.
function CalculatePower(velocity, params) {
    // calculate the forces on the rider.
    var forces = CalculateForces(velocity, params);
    var totalforce = forces.Fgravity + forces.Frolling + forces.Fdrag;

    // calculate necessary wheelpower
    var wheelpower = totalforce * (velocity * 1000.0 / 3600.0);

    // calculate necessary legpower
    var legpower = wheelpower / (1.0 - (params.rp_dtl/100.0));

    return legpower;
}

// Calculates the velocity obtained from a given power.  <params> is a
// dictionary containing the rider and model parameters, all in
// metric units.
//
// Runs a simple midpoint search, using CalculatePower().
//
// Returns velocity, in km/h.
export function CalculateVelocity(power, params) {
    // How close to get before finishing.
    var epsilon = 0.000001;

    // Set some reasonable upper / lower starting points.
    var lowervel = -1000.0;
    var uppervel = 1000.0;
    var midvel = 0.0;

    var midpow = CalculatePower(midvel, params);

    // Iterate until completion.
    var itcount = 0;
    do {
        if (Math.abs(midpow - power) < epsilon)
            break;

        if (midpow > power)
            uppervel = midvel;
        else
            lowervel = midvel;

        midvel = (uppervel + lowervel) / 2.0;
        midpow = CalculatePower(midvel, params);
    } while (itcount++ < 100);

    return midvel;
}
