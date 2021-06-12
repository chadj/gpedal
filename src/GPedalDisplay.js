import {geocode, getPanoramaByLocation} from './lib/gmapPromises';
import {timeout, dateFormat, hasStravaOauthTokens,
    getStravaOauthTokens, setStravaOauthTokens,
    removeStravaOauthTokens} from './lib/utils';
import {CalculateRho} from './lib/air_density';
import {CalculateVelocity} from './lib/power_v_speed';
import Mustache from 'mustache';
import {d3} from "./lib/d3Wrapper";
import {credentials} from "./lib/oauth";
import {RoutePoint} from "./Route";
import {managedLocalStorage} from './lib/managedLocalStorage';
import 'formdata-polyfill';


export class GPedalDisplay {
  constructor({id, powerMeter, heartMeter, cadenceMeter, riderWeight, unit, routeName='', history=[], points, ridingState}) {
    this.id = id;
    this.powerMeter = powerMeter;
    this.heartMeter = heartMeter;
    this.cadenceMeter = cadenceMeter;
    this.riderWeight = riderWeight;
    this.unit = unit;
    this.routeName = routeName;
    this.history = history;
    this.points = points;
    this.ridingState = ridingState;
    this.routeCompleted = false;
    this.powerSamples = [];

    if(this.id === undefined || this.id === null) {
      this.id = (new Date()).getTime();
    }

    if(typeof this.riderWeight === 'string') {
      this.riderWeight = parseInt(this.riderWeight);
    }

    if(this.ridingState === undefined || this.ridingState === null) {
      this.ridingState = {
        pointIdx: 0,
        point: this.points[0],
        pointPct: 0,
        lastSampleTime: new Date(),
        location: this.points[0].location,
        elevation: this.points[0].elevation,
        average_grade: 0,
        mapMode: 'SV',
        watts: 0,
        rpm: undefined,
        bpm: undefined,
        speed: 0,
        distance: 0,
        climb: 0,
        elapsed: 0,
      };
    }
  }

  async init() {
    this.miniMap = new google.maps.Map(document.getElementById('tracker'), {
      center: this.ridingState.point.location,
      zoom: 14,
      fullscreenControl: false,
      zoomControl: true,
      mapTypeId: google.maps.MapTypeId.TERRAIN
    });

    let simplePoints = this.points.map(p => {return {lat: p.location.lat(), lng: p.location.lng()}});
    let miniRoutePath = new google.maps.Polyline({
      path: simplePoints,
      geodesic: true,
      strokeColor: '#0c7ac9',
      strokeOpacity: 1.0,
      strokeWeight: 2
    });
    miniRoutePath.setMap(this.miniMap);

    this.fullMap = new google.maps.Map(document.getElementById('map-view'), {
      center: this.ridingState.point.location,
      zoom: 18,
      fullscreenControl: false,
      zoomControl: true,
      mapTypeId: google.maps.MapTypeId.TERRAIN
    });

    let routePath = new google.maps.Polyline({
      path: simplePoints,
      geodesic: true,
      strokeColor: '#0c7ac9',
      strokeOpacity: 1.0,
      strokeWeight: 2
    });
    routePath.setMap(this.fullMap);

    this.fullMarker = new google.maps.Marker({
        position: this.ridingState.point.location,
        map: this.fullMap,
        icon: './images/here.png'
    });
    this.fullMarker.setMap(this.fullMap);

    let streetview = this.streetViewPanoramaInit(this.ridingState.point.location, this.ridingState.point.heading);
    this.miniMap.setStreetView(streetview);

    // Init elevation graph
    this.zoomSvg = d3.select("#ui-elevation").append("svg")
      .attr("id", "ui-elevation-svg")
      .attr("x", 0)
      .attr("y", 0)
      .attr("viewBox", "0 0 150 60")
      .attr("preserveAspectRatio", "none");
    // end elevation graph

    this.drawHeightMap();

    this.powerMeter.addListener('power', power => this.collectPower(power));
    if(this.heartMeter) {
      this.heartMeter.addListener('hr', hr => this.collectHR(hr));
    }

    if(this.cadenceMeter) {
      this.cadenceMeter.addListener('cadence', cadence => this.collectCadence(cadence));
    }

    let geoResults = await geocode(this.points[0].location);
    let skipTypes = ["street_address", "route", "intersection", "postal_code"];
    for(let r of geoResults) {
      let type = '';
      if(r.types.length > 0) {
        type = r.types[0];
      }
      if(skipTypes.includes(type)) {
        continue;
      } else {
        this.routeName = r.formatted_address;
        break;
      }
    }
  }

  collectPower(power) {
    this.powerSamples.push(power);
  }

  collectHR(hr) {
    this.ridingState.bpm = hr;
  }

  collectCadence(cadence) {
    this.ridingState.rpm = cadence;
  }

  streetViewPanoramaInit(location, heading) {
    let $sv = document.getElementById("street-view");
    $sv.innerHTML = "";

    let streetview = new google.maps.StreetViewPanorama(
      $sv,
      {
        visible: true,
        fullscreenControl: false,
        clickToGo: false,
        addressControl: false,
        panControl: false,
        zoomControl: false,
        linksControl: false,
        pov: {heading: heading, pitch: 0},
        position: location
      }
    );

    streetview.addListener('status_changed', () => {
      streetview.setPov({heading: this.ridingState.point.heading, pitch: 0});
    });

    return streetview;
  }

  drawHeightMap() {
    this.fullSvg = d3.select("#ui-heightmap").append("svg")
      .attr("id", "ui-heightmap-svg")
      .attr("x", 0)
      .attr("y", 0)
      .attr("viewBox", "0 0 150 37.5")
      .attr("preserveAspectRatio", "none");

    this.fullSvgData = [];
    for(let i=0; i < this.points.length; i++) {
      this.fullSvgData.push([i, this.points[i].elevation]);
    }

    let [min, max] = d3.extent(this.fullSvgData, d => d[1]);
    if((max - min) < 125) max = min + 125;

    const zoomScaleY = d3.scaleLinear()
      .domain([max,min])
      .range([6, 33]);

    const zoomScaleX = d3.scaleLinear()
      .domain([0,this.points.length-1])
      .range([0,150]);

    this.fullSvgData = this.fullSvgData.map(d => {
        return [zoomScaleX(d[0]),zoomScaleY(d[1])];
    });

    this.fullSvgData.push([150, 37.5])
    this.fullSvgData.push([0, 37.5]);
    this.fullSvgData.push([0, this.fullSvgData[0][1]]);

    // Update
    let p = this.fullSvg.selectAll("polygon")
      .data([this.fullSvgData])
      .attr("points", d => {
        return d.map(d => {
            return [d[0],d[1]].join(",");
        }).join(" ");
      });

    // Enter
    p.enter()
      .append("polygon")
      .attr("points", d => {
        return d.map(d => {
            return [d[0],d[1]].join(",");
        }).join(" ");
      })
      .attr("fill", "#31A3CC")
      .attr("stroke", "#31A3CC")
      .attr("stroke-width", "1");
  }

  updateGraphs() {
    const graphPad = 60 * 0.32;

    let data = new Array(101);
    for(let i=0; i < data.length; i++) {
      let ptIdx = (i - 50) + this.ridingState.pointIdx;
      if(ptIdx < 0) ptIdx = 0;
      if(ptIdx >= this.points.length) ptIdx = this.points.length - 1;

      data[i] = [i, this.points[ptIdx].elevation];
    }

    let [min, max] = d3.extent(data, d => d[1]);
    if((max - min) < 50) max = min + 50;

    const zoomScaleY = d3.scaleLinear()
      .domain([max,min])
      .range([15, 60 - graphPad]);

    const zoomScaleX = d3.scaleLinear()
      .domain([0,100])
      .range([0,150]);

    data = data.map(d => {
        return [zoomScaleX(d[0]),zoomScaleY(d[1])];
    });
    data.push([150, 60])
    data.push([0, 60]);
    data.push([0, data[0][1]]);

    // Update
    let p = this.zoomSvg.selectAll("polygon")
      .data([data])
      .attr("points", d => {
        return d.map(d => {
            return [d[0],d[1]].join(",");
        }).join(" ");
      });

    // Enter
    p.enter()
      .append("polygon")
      .attr("points", d => {
        return d.map(d => {
            return [d[0],d[1]].join(",");
        }).join(" ");
      })
      .attr("fill", "#31A3CC")
      .attr("stroke", "#31A3CC")
      .attr("stroke-width", "1");

    // Update
    let m = this.zoomSvg.selectAll("image")
      .data([data[51]])
      .attr("x", d => {return d[0]-7.5})
      .attr("y", d => {return d[1]-15})
      .attr("width", "15")
      .attr("height", "15")
      .attr("xlink:href", "./images/marker.svg");

    // Enter
    m.enter()
      .append("image")
      .attr("x", d => {d[0]})
      .attr("y", d => {d[1]});

    // Update
    let f = this.fullSvg.selectAll("image")
      .data([this.fullSvgData[this.ridingState.pointIdx]])
      .attr("x", d => {return d[0]-3})
      .attr("y", d => {return d[1]-6})
      .attr("width", "6")
      .attr("height", "6")
      .attr("xlink:href", "./images/marker.svg");

    // Enter
    f.enter()
      .append("image")
      .attr("x", d => {d[0]})
      .attr("y", d => {d[1]});
  }

  async updatePosition() {
    let tick = 0;

    while(true) {
      if(this.routeCompleted) {
        break;
      }

      if(this.powerSamples.length) {
        this.ridingState.watts = this.powerSamples.reduce((a, b) => a + b, 0) / this.powerSamples.length;
        this.powerSamples.length = 0
      }

      let now = new Date();
      let duration = (now - this.ridingState.lastSampleTime) / 1000;
      this.ridingState.lastSampleTime = now;

      let capacity_remaining = 1;
      let total_distance = 0;
      let average_grade = 0;

      while(capacity_remaining > 0) {
        //console.log(this.ridingState.point.smoothedGrade, this.ridingState.point.grade, this.ridingState.point.elevation, this.ridingState.pointIdx);
        let velocity = this.speedFromPower(this.ridingState.watts, this.ridingState.point.smoothedGrade,
          this.ridingState.point.elevation);
        let smoothed_velocity = this.ridingState.speed + ((velocity - this.ridingState.speed) * 0.2);
        if(this.ridingState.watts < 50 && smoothed_velocity < 0.447) {
          smoothed_velocity = 0;
        }
        let can_travel = smoothed_velocity * duration * capacity_remaining;
        let distance_left = this.ridingState.point.distance - (this.ridingState.point.distance * this.ridingState.pointPct);

        if(can_travel > distance_left) {
          let capacity_used = distance_left / can_travel;
          average_grade += this.ridingState.point.smoothedGrade * capacity_used;

          capacity_remaining = capacity_remaining - (capacity_remaining * capacity_used);
          this.ridingState.pointIdx += 1;
          this.ridingState.pointPct = 0;
          this.ridingState.climb += this.ridingState.point.climb;
          this.ridingState.point = this.points[this.ridingState.pointIdx];
          total_distance += distance_left;
          if(this.ridingState.pointIdx >= this.points.length) {
            break;
          }
        } else {
          let capacity_used = capacity_remaining;
          average_grade += this.ridingState.point.smoothedGrade * capacity_used;

          capacity_remaining = 0;
          if(distance_left !== 0) {
            this.ridingState.pointPct = 1 - ((distance_left - can_travel) / this.ridingState.point.distance);
            //console.log(this.ridingState.speed, velocity, smoothed_velocity, can_travel, distance_left, this.ridingState.pointPct);
            total_distance += can_travel;
          } else {
            this.ridingState.pointPct = 0;
          }
        }
      }

      if(this.ridingState.pointIdx >= this.points.length) {
        break;
      }

      this.ridingState.average_grade = average_grade;
      this.ridingState.distance += total_distance;
      this.ridingState.elevation = this.ridingState.point.elevation + (this.ridingState.point.opposite * this.ridingState.pointPct);
      this.ridingState.speed = (total_distance / duration);
      if(this.ridingState.speed > 0) {
        this.ridingState.elapsed += duration;
      }

      this.ridingState.location = google.maps.geometry.spherical.interpolate(this.ridingState.point.location,
        this.points[this.ridingState.pointIdx+1].location, this.ridingState.pointPct);

      this.history.push({
          time: now,
          location: this.ridingState.location,
          power: this.ridingState.watts,
          elevation: this.ridingState.elevation,
          hr: this.ridingState.bpm,
          cad: this.ridingState.rpm
      });

      if(tick % 5 === 0) {
        let streetview = this.miniMap.getStreetView();
        try {
          let data = await getPanoramaByLocation(this.ridingState.location, 50);

          // Is this a user submitted panorama?  If so, don't display it.
          if(!('profileUrl' in data.location)) {
            if(this.ridingState.mapMode === 'MV') {
              document.getElementById('map-view').style.display = 'none';
              document.getElementById('tracker').style.display = 'block';
              document.getElementById('street-view').style.display = 'block';
              streetview.setVisible(true);
              google.maps.event.trigger(streetview, 'resize');
              google.maps.event.trigger(this.miniMap, 'resize');
            }

            this.miniMap.panTo(this.ridingState.location);
            if(this.ridingState.mapMode === 'MV') {
              streetview.setPano(data.location.pano);
            } else {
              streetview.setPosition(this.ridingState.location);
            }
            this.ridingState.mapMode = 'SV';
          }
        } catch (error) {
          // streetview not available
          if(this.ridingState.mapMode === 'SV') {
            streetview.setVisible(false);
            document.getElementById('street-view').style.display = 'none';
            document.getElementById('tracker').style.display = 'none';
            document.getElementById('map-view').style.display = 'block';
            google.maps.event.trigger(this.fullMap, 'resize');
          }

          this.ridingState.mapMode = 'MV';
          this.fullMap.panTo(this.ridingState.location);
          this.fullMarker.setPosition(this.ridingState.location);
        }

        //console.log(this.ridingState.location.lat(), this.ridingState.location.lng(), this.ridingState.point.heading);
      }

      if(tick % 30 === 0) {
        Promise.resolve().then(() => {
          managedLocalStorage.set(this.cacheName(), this);
        });
      }

      this.updateGraphs();

      tick += 1;
      await timeout(1000);
    }

    this.routeCompleted = true;
  }

  speedFromPower(power, grade, elevation) {
    let temp = 23.8889;
    let pressure = Math.exp(-elevation / 7000) * 1000;
    let dew = 7.5;

    let options = {
      units: 'metric',
      // Rider Weight
      rp_wr: this.riderWeight * (this.unit === 'imperial' ? 0.453592 : 1),
      // Bike Weight
      rp_wb: 8,
      //  Frontal area A(m2)
      rp_a: 0.65,
      // Drag coefficient Cd
      rp_cd: 0.63,
      // Drivetrain loss Lossdt (%)
      rp_dtl: 4,
      // Coefficient of rolling resistance Crr
      ep_crr: 0.005,
      // Grade %
      ep_g: grade,
      ep_rho: CalculateRho(temp, pressure, dew)
    }

    let velocity = CalculateVelocity(power, options);
    // convert to m/s
    velocity = velocity * 0.277778;

    return velocity;
  }

  async updateUI() {
    while(true) {
      if(this.routeCompleted) {
        break;
      }

      let sec_num = this.ridingState.elapsed.toFixed();
      let hours   = Math.floor(sec_num / 3600);
      let minutes = Math.floor((sec_num - (hours * 3600)) / 60);
      let seconds = sec_num - (hours * 3600) - (minutes * 60);
      //if (hours   < 10) {hours   = "0"+hours;}
      if (minutes < 10) {minutes = "0"+minutes;}
      if (seconds < 10) {seconds = "0"+seconds;}
      let time;
      if(hours !== 0) {
        time = hours+':'+minutes+':'+seconds;
      } else {
        time = minutes+':'+seconds;
      }

      let distance = (this.ridingState.distance * (this.unit === 'imperial' ? 0.000621371 : 0.001));
      if(distance >= 100) {
        distance = distance.toFixed();
      } else {
        distance = distance.toFixed(1);
      }

      let grade = this.ridingState.average_grade.toFixed(1);
      if(grade === '-0' || grade === '-0.0') {
        grade = '0.0';
      }
      let $grade = document.getElementById('grade-unit-icon');
      if(grade >= 0) {
        if($grade.classList.contains('fa-long-arrow-down')) {
          $grade.classList.remove('fa-long-arrow-down');
          $grade.classList.add('fa-long-arrow-up');
        }
      } else {
        if($grade.classList.contains('fa-long-arrow-up')) {
          $grade.classList.remove('fa-long-arrow-up');
          $grade.classList.add('fa-long-arrow-down');
        }
      }

      let watts = this.ridingState.watts;
      if(watts !== undefined && watts !== null) {
        watts = watts.toFixed();
      } else {
        watts = '--';
      }

      let bpm = this.ridingState.bpm;
      if(bpm !== undefined && bpm !== null) {
        bpm = bpm.toFixed();
      } else {
        bpm = '--';
      }

      let rpm = this.ridingState.rpm;
      if(rpm !== undefined && rpm !== null) {
        rpm = rpm.toFixed();
      } else {
        rpm = '--';
      }

      document.getElementById('watts').innerHTML = watts;
      document.getElementById('heart').innerHTML = bpm;
      document.getElementById('cadence').innerHTML = rpm;
      document.getElementById('speed').innerHTML = (this.ridingState.speed * (this.unit === 'imperial' ? 2.23694 : 3.6)).toFixed();
      document.getElementById('distance').innerHTML = distance;
      document.getElementById('climb').innerHTML = (this.ridingState.climb * (this.unit === 'imperial' ? 3.28084 : 1)).toFixed();
      document.getElementById('time').innerHTML = time;
      document.getElementById('grade').innerHTML = grade;

      document.getElementById('distance-unit-value').innerHTML = this.unit === 'imperial' ? 'mi' : '&nbsp;km';
      document.getElementById('speed-unit-value').innerHTML = this.unit === 'imperial' ? 'mph' : 'kph';
      document.getElementById('climb-container-value').innerHTML = this.unit === 'imperial' ? 'ft' : 'm';

      await timeout(1000);
    }
  }

  async stravaExport() {
    let $stva = document.getElementById('btn-export-strava');
    if(!$stva.classList.contains('disabled')) {
      $stva.classList.add('disabled');
    } else {
      return;
    }

    $stva.innerHTML = "Exporting";
    let $name = document.getElementById('input-ride-name');
    let name = $name.value;

    let template = document.getElementById('strava-gpx-template').innerHTML;
    let points = this.history.map(h => {
      return {
        lat: h.location.lat(),
        lng: h.location.lng(),
        elevation: h.elevation.toFixed(5),
        time: dateFormat(h.time),
        power: h.power,
        hr: h.hr,
        cad: h.cad
      }
    });

    let gpxBody = Mustache.render(template, {
      export_time: dateFormat(new Date()),
      export_name: name,
      points: points
    });

    let stravaOauth = getStravaOauthTokens();
    let tokenForm = new FormData();
    tokenForm.set('client_id', credentials.STRAVA_CLIENT_ID);
    tokenForm.set('client_secret', credentials.STRAVA_CLIENT_SECRET);
    tokenForm.set('refresh_token', stravaOauth.refresh_token);
    tokenForm.set('grant_type', 'refresh_token');
    let token_response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      body: tokenForm
    });
    if(!token_response.ok) {
        let err = await token_response.json();
        let msg = err.message;
        let reason = JSON.stringify(err.errors);
        let $strvape = document.getElementById('strva-post-error');
        $strvape.innerHTML = `<p>An error occurred while authorizing with Strava</p><p>${msg} - ${reason}</p><br /><br />`;
        $strvape.style.display = 'block';
        $name.style.display = 'none';
        return;
    }
    let token_body = await token_response.json();
    stravaOauth.access_token = token_body.access_token;
    stravaOauth.refresh_token = token_body.refresh_token;
    setStravaOauthTokens(stravaOauth);

    let gpxFile = new File([gpxBody], "import_to_strava.gpx", {type : 'text/xml'});
    let form = new FormData();
    form.set('activity_type', 'virtualride');
    form.set('name', name);
    form.set('data_type', 'gpx');
    form.set('file', gpxFile);
    let headers = new Headers();
    headers.set('Authorization', 'Bearer ' + stravaOauth.access_token);
    let response = await fetch('https://www.strava.com/api/v3/uploads', {
      method: 'POST',
      headers: headers,
      body: form
    });
    if(!response.ok) {
        let err = await response.json();
        let msg = err.message;
        let reason = JSON.stringify(err.errors);
        let $strvape = document.getElementById('strva-post-error');
        $strvape.innerHTML = `<p>An error occurred while uploading to Strava</p><p>${msg} - ${reason}</p><br /><br />`;
        $strvape.style.display = 'block';
        $name.style.display = 'none';
        return;
    }
    let body = await response.json();
    let req_id = body.id;

    while(true) {
      let status_response = await fetch('https://www.strava.com/api/v3/uploads/' + req_id, {
        headers: headers
      });
      if(!status_response.ok) {
        let err = await status_response.json();
        let msg = err.message;
        let reason = JSON.stringify(err.errors);
        let $strvape = document.getElementById('strva-post-error');
        $strvape.innerHTML = `<p>An error occurred while waiting on upload to Strava</p><p>${msg} - ${reason}</p><br /><br />`;
        $strvape.style.display = 'block';
        $name.style.display = 'none';
        return;
      }
      let status_body = await status_response.json();
      if(status_body.activity_id) {
        break;
      }

      await timeout(4000);
    }

    this.routeCompleted = true;
    managedLocalStorage.remove('route-progress', this.cacheName());
    $stva.innerHTML = "Done!";
  }

  showFinalizeUI(msg) {
    document.getElementById('ui-finalize-container').style.display = 'block';
    document.getElementById('ui-finalize-label').innerHTML = msg;
    if(hasStravaOauthTokens()) {
      let now = new Date();
      let ride_name = "GPedal - ";
      if(this.routeName) {
        ride_name += this.routeName;
      } else {
        ride_name += (now.getMonth() + 1) + "/" + now.getDate()
      }
      let $name = document.getElementById('input-ride-name');
      $name.value = ride_name;
      $name.style.display = 'block';

      let $stva = document.getElementById('btn-export-strava');
      $stva.style.display = 'block';
      $stva.onclick = e => {
        e.preventDefault();

        this.stravaExport()
          .catch(error => {
            console.log("Error: ", error);
          });
      };
    }
  }

  cacheName() {
    return "route-progress-"+this.id;
  }

  toJSON() {
    let {history, id, points, riderWeight, ridingState, routeName, unit} = this;

    history = history.map(h => {
      h = Object.assign({}, h);
      h.location = h.location.toJSON();
      h.time = h.time.toJSON();
      return h;
    });

    points = points.map(p => {return p.toJSON()});

    ridingState = Object.assign({}, ridingState);
    ridingState.lastSampleTime = ridingState.lastSampleTime.toJSON();
    ridingState.location = ridingState.location.toJSON();
    ridingState.point = ridingState.point.toJSON();
    ridingState.bpm = undefined;
    ridingState.rpm = undefined;
    ridingState.speed = 0;
    ridingState.watts = 0;

    return {history, id, points, riderWeight, ridingState, routeName, unit};
  }

  static fromJSON(obj) {
    for(let h of obj.history) {
      h.location = new google.maps.LatLng(h.location.lat, h.location.lng);
      h.time = new Date(h.time);
    }

    obj.points = obj.points.map(p => {return RoutePoint.fromJSON(p)});

    obj.ridingState.lastSampleTime = new Date(obj.ridingState.lastSampleTime);
    obj.ridingState.location = new google.maps.LatLng(obj.ridingState.location.lat, obj.ridingState.location.lng);
    obj.ridingState.point = RoutePoint.fromJSON(obj.ridingState.point);

    return new GPedalDisplay(obj);
  }

  static transitionUI() {
    document.getElementById('configure-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
  }
}
