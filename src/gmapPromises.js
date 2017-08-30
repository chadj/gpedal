let elevationService = new google.maps.ElevationService();
let streetViewService = new google.maps.StreetViewService();
let geocoder = new google.maps.Geocoder;

export function geocode(location) {
  return new Promise(function(resolve,reject) {
    geocoder.geocode({'location': location}, function(results, status) {
      if (status === 'OK') {
        resolve(results);
      } else {
        reject(new Error(status));
      }
    });
  });
}

export function getPanoramaByLocation(location, radius) {
  return new Promise(function(resolve,reject) {
    let request = {
      location: location,
      radius: radius
    };
    streetViewService.getPanorama(request, (results, status) => {
      if (status == google.maps.StreetViewStatus.OK) {
        resolve(results);
      } else {
        reject(new Error(status));
      }
    });
  });
}

export function getElevationAlongPath(elevationRequest) {
  return new Promise(function(resolve,reject) {
    elevationService.getElevationAlongPath(elevationRequest, (results, status) => {
      if (status == google.maps.ElevationStatus.OK) {
        resolve(results);
      } else {
        reject(new Error(status));
      }
    });
  });
}
