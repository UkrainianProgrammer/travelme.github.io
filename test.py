#!/usr/bin/env python3

import requests
import json

base_url = "http://transport.tamu.edu/BusRoutesFeed/api/route"

def get_bus_url(route_num):
    return base_url + "/{}/buses/mentor".format(route_num)


def get_route_url(route_num, date):
    return base_url + "/{}/pattern".format(route_num)


if __name__ == "__main__":
    data = requests.get(get_route_url("04", "2017-04-26")).json()

    for i in range(10):
        print(json.dumps(data[i], indent=4))
