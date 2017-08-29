import {geocode, getPanoramaByLocation} from './gmapPromises';
import {timeout, dateFormat} from './lib/utils';
import {CalculateRho} from './lib/air_density';
import {CalculateVelocity} from './lib/power_v_speed';
import Mustache from 'mustache';

export class GPedalDisplay {
  constructor(points, riderWeight, powerMeter, heartMeter, cadenceMeter) {
    this.powerMeter = powerMeter;
    this.heartMeter = heartMeter;
    this.cadenceMeter = cadenceMeter;
    this.riderWeight = parseInt(riderWeight);
    this.routeName = '';
    this.history = [];
    this.powerSamples = [];
    this.points = points;
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
        icon: '/images/here.png'
    });
    this.fullMarker.setMap(this.fullMap);

    let streetview = this.streetViewPanoramaInit(this.ridingState.point.location, this.ridingState.point.heading);
    this.miniMap.setStreetView(streetview);

    this.powerMeter.addListener('power', power => this.collectPower(power));
    if(this.heartMeter) {
      this.heartMeter.addListener('hr', hr => this.collectHR(hr));
    }

    if(this.cadenceMeter) {
      this.cadenceMeter.addListener('cadence', cadence => this.collectCadence(cadence));
    }
  }

  async geocodeRoute() {
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

  async updatePosition() {
    let tick = 0;

    while(true) {
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
        if(smoothed_velocity < 0.447) {
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

          if(this.ridingState.mapMode === 'MV') {
            document.getElementById('map-view').style.display = 'none';
            document.getElementById('tracker').style.display = 'block';
            document.getElementById('street-view').style.display = 'block';
            streetview.setVisible(true);
            google.maps.event.trigger(streetview, 'resize');
            google.maps.event.trigger(this.miniMap, 'resize');
          }

          //map.setCenter(this.ridingState.location);
          this.miniMap.panTo(this.ridingState.location);
          if(this.ridingState.mapMode === 'MV') {
            streetview.setPano(data.location.pano);
          } else {
            streetview.setPosition(data.location.latLng);
          }
          //streetview.setPov({heading: this.ridingState.point.heading, pitch: 0});
          this.ridingState.mapMode = 'SV';
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

      tick += 1;
      await timeout(1000);
    }
  }

  speedFromPower(power, grade, elevation) {
    let temp = 23.8889;
    let pressure = Math.exp(-elevation / 7000) * 1000;
    let dew = 7.5;

    let options = {
      units: 'metric',
      // Rider Weight
      rp_wr: this.riderWeight * 0.453592,
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

      let distance = (this.ridingState.distance * 0.000621371);
      if(distance > 100) {
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
      document.getElementById('speed').innerHTML = (this.ridingState.speed * 2.23694).toFixed();
      document.getElementById('distance').innerHTML = distance;
      document.getElementById('climb').innerHTML = (this.ridingState.climb * 3.28084).toFixed();
      document.getElementById('time').innerHTML = time;
      document.getElementById('grade').innerHTML = grade;

      // document.getElementById('watts').innerHTML = 2500;
      // document.getElementById('heart').innerHTML = 260;
      // document.getElementById('cadence').innerHTML = 230;
      // document.getElementById('speed').innerHTML = 188;
      // document.getElementById('distance').innerHTML = 55.3;
      // document.getElementById('climb').innerHTML = 2300;
      // document.getElementById('time').innerHTML = '0:00:00';

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

    let tokenForm = new FormData();
    tokenForm.set('client_id', '19775');
    tokenForm.set('client_secret', 'd1fd34e8c88fc5611ff41d9361e0668e9fe676f0');
    tokenForm.set('code', localStorage.getItem('strava-oauth-code'));
    let token_response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      body: tokenForm
    });
    let token_body = await token_response.json();
    let access_token = token_body.access_token;

    let gpxFile = new File([gpxBody], "import_to_strava.gpx", {type : 'text/xml'});
    let form = new FormData();
    form.set('activity_type', 'virtualride');
    form.set('name', name);
    form.set('data_type', 'gpx');
    form.set('file', gpxFile);
    let headers = new Headers();
    headers.set('Authorization', 'Bearer ' + access_token);
    let response = await fetch('https://www.strava.com/api/v3/uploads', {
      method: 'POST',
      headers: headers,
      body: form
    });
    let body = await response.json();
    let req_id = body.id;

    while(true) {
      let status_response = await fetch('https://www.strava.com/api/v3/uploads/' + req_id, {
        headers: headers
      });
      let status_body = await status_response.json();
      if(status_body.activity_id) {
        break;
      }

      await timeout(4000);
    }
    $stva.innerHTML = "Done!";

  }

  showFinalizeUI() {
    document.getElementById('ui-finalize-container').style.display = 'block';
    if(localStorage.getItem('strava-oauth-code')) {
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

  static transitionUI() {
    document.getElementById('configure-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
  }
}
