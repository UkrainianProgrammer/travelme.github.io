"use strict";
///<reference path="../../../.WebStorm2017.1/config/javascript/extLibs/http_github.com_DefinitelyTyped_DefinitelyTyped_raw_master_types_jquery_index.d.ts"/>
// Start reorganization, for testing purposes
// Object.defineProperty(exports, "__esModule", { value: true });
var myCenter = { lat: 30.618986, lng: -96.338843 };
var map;
var colors = {
    // On-campus
    "01": "#624099",
    "02": "#ea7401",
    "03": "#010101",
    "04": "#ec2727",
    "05": "#5e9bd3",
    "06": "#14b24b",
    "08": "#e9168b",
    "09": "#dc143c",
    "N_W04": "#ec2727",
    // Off-campus
    "12": "#0054a6",
    "15": "#28903a",
    "22": "#bd1a8d",
    "26": "#006f3b",
    "27": "#00aeef",
    "31": "#662d91",
    "34": "#ea7424",
    "35": "#603813",
    "36": "#967348",
    "40": "#55565a" // Century Tree
};
// URL for the API. Using crossorigin.me to avoid CORS issues
var CORSProxy = "https://cors-anywhere.herokuapp.com/";
// let CORSProxy = "https://crossorigin.me/";
var baseRouteURL = CORSProxy + "http://transport.tamu.edu/BusRoutesFeed/api/route/";
var baseInfoURL = CORSProxy + "http://transport.tamu.edu/BusRoutesFeed/api/Routes/";
var streetViewKey = "AIzaSyApnDIhQCHC48M5bTlBiSJ5iSpy501yIQc";
var streetViewURL = "https://maps.googleapis.com/maps/api/streetview?";
var streetViewSize = "size=400x150&";
var streetViewFOV = "fov=360&";
//location=40.720032,-73.988354&fov=90&heading=235&pitch=10&key="
var Stop = (function () {
    function Stop(latLng, isTimePoint, name, hasMarker) {
        if (hasMarker === void 0) { hasMarker = true; }
        this.latLng = latLng;
        this.isTimePoint = isTimePoint;
        this.name = name;
        var street = streetViewURL + streetViewSize + streetViewFOV + "location=" + latLng.lat + "," + latLng.lng;
        street += "&heading=0&pitch=10&key=" + streetViewKey;
        var infoWindow = new google.maps.InfoWindow({
            content: '<p><b>' + name + '</b></p><p><img src="' + street + '"/></p>'
        });
        this.infoWindow = infoWindow;
        if (hasMarker) {
            var marker_1 = new google.maps.Marker({
                position: this.latLng,
                map: map,
                title: this.name
            });
            this.marker = marker_1;
            this.marker.addListener('click', function () {
                infoWindow.open(map, marker_1);
            });
        }
        else {
            this.marker = null;
        }
    }
    Stop.prototype.show = function () {
        if (this.marker) {
            this.marker.setMap(map);
        }
    };
    Stop.prototype.hide = function () {
        if (this.marker) {
            this.marker.setMap(null);
        }
    };
    return Stop;
}());
var Bus = (function () {
    function Bus(latLng, rotation) {
        this.latLng = latLng;
        this.rotation = rotation;
        this.marker = new google.maps.Marker({
            position: this.latLng,
            map: map,
            icon: {
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 4,
                anchor: new google.maps.Point(0, 3),
                rotation: this.rotation,
                fillOpacity: 1.0,
                strokeColor: "#500000",
                fillColor: "#500000"
            },
            title: "bus"
        });
    }
    Bus.prototype.hide = function () {
        if (this.marker) {
            this.marker.setMap(null);
            this.marker = null;
        }
    };
    return Bus;
}());
function getJSON(url) {
    var ret = null;
    $.ajax({
        type: "GET",
        url: url,
        async: false,
        dataType: 'json',
        success: function (json) {
            ret = json;
        },
        error: function (jqXHR, textStatus, errorThrown) {
        }
    });
    return ret;
}
// Function to convert between fucking stupid coordinate system and real lat/long
function convertCoords(x, y) {
    var stupid = 'PROJCS["NAD_1983_StatePlane_Texas_Central_FIPS_4203",GEOGCS["GCS_North_American_1983",DATUM["D_North_American_1983",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Lambert_Conformal_Conic"],PARAMETER["False_Easting",700000.0],PARAMETER["False_Northing",3000000.0],PARAMETER["Central_Meridian",-100.3333333333333],PARAMETER["Standard_Parallel_1",30.11666666666667],PARAMETER["Standard_Parallel_2",31.88333333333333],PARAMETER["Latitude_Of_Origin",29.66666666666667],UNIT["Meter",1.0]]';
    var normal = 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';
    // Everything is flipped for some goddamn reason
    var result = proj4(stupid, normal, [y, x]);
    return { lat: result[1], lng: result[0] };
}
var Route = (function () {
    function Route(id) {
        this.id = id;
        this.color = colors[id];
        this.url = baseRouteURL.concat(id).concat('/pattern');
        this.busUrl = baseRouteURL.concat(id).concat('/buses/mentor');
        this.stops = [];
        this.buses = [];
        this.isDrawn = false;
    }
    Route.prototype.show = function () {
        if (this.isDrawn) {
            this.path.setVisible(true);
            this.stops.forEach(function (stop) {
                stop.show();
            });
        }
        else {
            this.fetch();
            this.isDrawn = true;
        }
        this.fetchBuses();
        map.setCenter(this.stops[0].latLng);
    };
    Route.prototype.hide = function () {
        if (this.path) {
            this.path.setVisible(false);
        }
        if (this.stops) {
            this.stops.forEach(function (stop) {
                if (stop) {
                    stop.hide();
                }
            });
        }
        if (this.buses) {
            this.buses.forEach(function (bus) {
                if (bus) {
                    bus.hide();
                }
            });
        }
    };
    Route.prototype.fetch = function () {
        var json = null;
        while (json == null) {
            json = getJSON(this.url);
        }
        var pathCoordinates = [];
        var stops = [];
        var timepoints = [];
        var color = this.color;
        var path;
        json.forEach(function (waypoint) {
            var lat = waypoint["Latitude"];
            var lng = waypoint["Longtitude"];
            var latLng = convertCoords(lat, lng);
            // Add the waypoint to the path
            pathCoordinates.push(latLng);
            // If the waypoint is a stop, add it to the stops
            if (waypoint["PointTypeCode"] === 1) {
                stops.push(new Stop(latLng, waypoint["Stop"]["IsTimePoint"], waypoint["Name"]));
                if (waypoint["Stop"]["IsTimePoint"]) {
                    timepoints.push(new Stop(latLng, waypoint["Stop"]["IsTimePoint"], waypoint["Name"], false));
                }
            }
        });
        // Set up the Polyline
        path = new google.maps.Polyline({
            path: pathCoordinates,
            geodesic: false,
            strokeColor: color,
            strokeOpacity: 1.0,
            strokeWeight: 4
        });
        json = null;
        while (json == null) {
            json = getJSON(baseInfoURL.concat(this.id));
        }
        this.name = json["Name"];
        path.setMap(map);
        this.stops = stops;
        this.timepoints = timepoints;
        this.path = path;
    };
    Route.prototype.fetchBuses = function () {
        if (this.buses) {
            this.buses.forEach(function (bus) {
                if (bus) {
                    bus.hide();
                }
            });
        }
        var json = null;
        while (json == null) {
            json = getJSON(this.busUrl);
        }
        var buses = [];
        json.forEach(function (bus) {
            var lat = bus["GPS"]["Lat"];
            var lng = bus["GPS"]["Long"];
            var latLng = convertCoords(lat, lng);
            buses.push(new Bus(latLng, bus["GPS"]["Dir"]));
        });
        this.buses = buses;
    };
    return Route;
}());
var routes = {
    "01": new Route("01"),
    "02": new Route("02"),
    "03": new Route("03"),
    "04": new Route("04"),
    "05": new Route("05"),
    "06": new Route("06"),
    "08": new Route("08"),
    "09": new Route("09"),
    "N_W04": new Route("N_W04"),
    "12": new Route("12"),
    "15": new Route("15"),
    "22": new Route("22"),
    "26": new Route("26"),
    "27": new Route("27"),
    "31": new Route("31"),
    "34": new Route("34"),
    "35": new Route("35"),
    "36": new Route("36"),
    "40": new Route("40")
};
function initialize() {
    var mapProp = {
        center: myCenter,
        zoom: 14,
        scrollwheel: false,
        draggable: true
    };
    // generate new map
    map = new google.maps.Map(document.getElementById("googleMap"), mapProp);
    // new info window for geolocation
    var infoWindow = new google.maps.InfoWindow({ map: map });
    // trying HTML5 geolocation
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (position) {
            var pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            // drop a marker where user is located
            var marker = new google.maps.Marker({
                position: pos,
                map: map,
                label: "V"
            });
            infoWindow.setPosition(pos);
            infoWindow.setContent('Current Location');
            infoWindow.open(map, marker); // show info above marker
            // map.setCenter(pos);
        }, function () {
            // if location is not found
            handleLocationError(true, infoWindow, map.getCenter());
        });
    }
    else {
        // if browser does not support geolocation
        handleLocationError(false, infoWindow, map.getCenter());
    }
}
function handleLocationError(browserHasGeolocation, infoWindow, pos) {
    infoWindow.setPosition(pos);
    infoWindow.setContent(browserHasGeolocation ? 'Error: The Geolocation service failed.' :
        'Error: Your browser doesn\'t support Geolocation.');
}
function myMap(data) { }
// load the map in index.html
google.maps.event.addDomListener(window, 'load', initialize);
function updateBus() {
    routes[currentRoute].fetchBuses();
}
var refresh = null;
var currentRoute = null;
function buttonScript(button) {
    clearInterval(refresh);
    currentRoute = button;
    // Scroll the page to the map
    location.href = "#googleMap";
    // Hide other routes
    for (var route in routes) {
        routes[route].hide();
    }
    // Show the selected route
    routes[button].show();
    // Set the sidebar header
    var route_title = document.getElementById("sidebar_head");
    route_title.innerText = routes[button].id.concat(": ").concat(routes[button].name);
    // Set the timepoint names in the sidebar
    var route_table = document.getElementById("sidebar_table");
    var table_string = "<thead><th colspan=\"" + (routes[button].timepoints.length - 1) + "\">Leave</th><th>Arrive</th></thead>";
    table_string += '<tr class="w3-green" id="timepoints">';
    routes[button].timepoints.forEach(function (point) {
        table_string += "<td>" + point.name + "</td>";
    });
    table_string += '</tr>';
    // Set the times
    var times = null;
    while (times == null) {
        times = getJSON(baseRouteURL.concat(button).concat("/TimeTable"));
    }
    // Put the times in the table
    times.forEach(function (time) {
        table_string += "<tr>";
        for (var stop_1 in time) {
            table_string += "<td>";
            if (time[stop_1] !== null) {
                table_string += time[stop_1];
            }
            else {
                table_string += "—";
            }
            table_string += "</td>";
        }
        table_string += "</tr>\n";
    });
    route_table.innerHTML = table_string;
    // Change the hamburger button to the word Timetable
    var sidebar_button = document.getElementById("button");
    sidebar_button.innerText = "Timetable";
    // Start refreshing the bus route every few seconds
    refresh = setInterval(updateBus, 15000);
}
//# sourceMappingURL=main.js.map