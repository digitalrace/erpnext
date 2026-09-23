import frappe
import requests


TRACCAR_URL = "http://traccar:8082"
TRACCAR_EMAIL = "powerpartnerhq@gmail.com"
TRACCAR_PASSWORD = "admin"


@frappe.whitelist()
def get_tracking_employees():
    if not frappe.has_permission("Employee", ptype="read"):
        frappe.throw("You do not have permission to view Employee tracking.")

    return frappe.get_list(
        "Employee",
        filters={"custom_enable_live_tracking": 1},
        fields=["name", "employee_name"],
        order_by="employee_name asc",
        limit_page_length=500,
    )


def _traccar_login():
    session = requests.Session()
    response = session.post(
        TRACCAR_URL + "/api/session",
        data={
            "email": TRACCAR_EMAIL,
            "password": TRACCAR_PASSWORD,
        },
        timeout=10,
    )
    response.raise_for_status()
    return session


def _get_traccar_device(session, employee_id):
    response = session.get(
        TRACCAR_URL + "/api/devices",
        params={"uniqueId": employee_id},
        timeout=10,
    )
    response.raise_for_status()

    devices = response.json()
    if not devices:
        return None

    return devices[0]


def _format_traccar_time(value):
    if not value:
        return None

    try:
        dt = frappe.utils.get_datetime(value)
        dt = frappe.utils.convert_utc_to_system_timezone(dt)
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return str(value)


def get_traccar_live(employee_id):
    result = {
        "online": False,
        "status": "OFFLINE",
        "device_id": None,
        "latitude": None,
        "longitude": None,
        "speed": 0,
        "address": "",
        "time": None,
        "accuracy": None,
    }

    try:
        session = _traccar_login()
        device = _get_traccar_device(session, employee_id)

        if not device:
            return result

        device_id = device.get("id")
        result["device_id"] = device_id

        device_status = (device.get("status") or "").lower()
        result["online"] = device_status == "online"
        result["status"] = "ONLINE" if result["online"] else "OFFLINE"

        if not device_id:
            return result

        response = session.get(
            TRACCAR_URL + "/api/positions",
            params={"deviceId": device_id},
            timeout=10,
        )
        response.raise_for_status()

        positions = response.json()
        if not positions:
            return result

        position = positions[0]

        result["latitude"] = position.get("latitude")
        result["longitude"] = position.get("longitude")
        result["speed"] = round(float(position.get("speed") or 0), 2)
        result["accuracy"] = position.get("accuracy")
        result["time"] = _format_traccar_time(
            position.get("fixTime") or position.get("deviceTime")
        )

        address = position.get("address") or ""

        # Do not geocode on every 30-second dashboard refresh.
        # The stored Employee Location Log already contains geocoded addresses.
        result["address"] = address

    except Exception as e:
        frappe.log_error(
            "Employee: " + str(employee_id)
            + "\nTraccar Live Error: " + str(e),
            "Live Tracking Traccar Error",
        )

    return result


@frappe.whitelist()
def get_traccar_status(employee_id):
    if not employee_id:
        frappe.throw("Employee is required.")

    if not frappe.has_permission("Employee", ptype="read"):
        frappe.throw("You do not have permission to view Employee tracking.")

    return get_traccar_live(employee_id)


@frappe.whitelist()
def get_tracking_data(employee, from_date, to_date):
    if not employee:
        frappe.throw("Employee is required.")

    if not from_date:
        frappe.throw("From Date is required.")

    if not to_date:
        frappe.throw("To Date is required.")

    if not frappe.has_permission("Employee", ptype="read"):
        frappe.throw("You do not have permission to view Employee tracking.")

    if not frappe.has_permission("Employee Location Log", ptype="read"):
        frappe.throw("You do not have permission to view location logs.")

    from_datetime = str(from_date) + " 00:00:00"
    to_datetime = str(to_date) + " 23:59:59"

    employee_list = frappe.get_list(
        "Employee",
        filters={
            "name": employee,
            "custom_enable_live_tracking": 1,
        },
        fields=[
            "name",
            "employee_name",
            "custom_enable_live_tracking",
        ],
        limit_page_length=1,
    )

    if not employee_list:
        frappe.throw("Employee not found or live tracking is disabled.")

    employee_doc = employee_list[0]

    logs = frappe.get_list(
        "Employee Location Log",
        filters=[
            ["employee", "=", employee],
            ["time", ">=", from_datetime],
            ["time", "<=", to_datetime],
        ],
        fields=[
            "name",
            "employee",
            "latitude",
            "longitude",
            "time",
            "speed",
            "address",
            "distance",
            "total_distance",
        ],
        order_by="time asc",
        limit_page_length=5000,
    )

    for log in logs:
        log["latitude"] = float(log.get("latitude") or 0)
        log["longitude"] = float(log.get("longitude") or 0)
        log["speed"] = round(float(log.get("speed") or 0), 2)
        log["distance"] = round(float(log.get("distance") or 0), 3)
        log["total_distance"] = round(float(log.get("total_distance") or 0), 3)
        log["address"] = log.get("address") or ""

        if log.get("time"):
            log["time"] = str(log["time"])

    total_locations = len(logs)

    total_distance = 0
    if len(logs) >= 2:
        total_values = [
            float(log.get("total_distance") or 0)
            for log in logs
        ]
        total_distance = max(total_values) - min(total_values)

    total_distance = round(max(total_distance, 0), 3)

    latest = logs[-1] if logs else None

    # Current device state + current Traccar position.
    live = get_traccar_live(employee)

    # If Traccar does not return an address, use the last stored geocoded address.
    if not live.get("address") and latest:
        live["address"] = latest.get("address") or ""

    return {
        "employee": employee_doc,
        "logs": logs,
        "live": live,
        "summary": {
            "total_locations": total_locations,
            "total_distance": total_distance,
            "online": live["online"],
            "status": live["status"],
            "device_id": live["device_id"],

            # Live values must come from Traccar, not the 10-minute ERP snapshot.
            "last_update": live.get("time") or (
                latest.get("time") if latest else None
            ),
            "latest_address": live.get("address") or (
                latest.get("address") if latest else ""
            ),
            "latest_latitude": (
                live.get("latitude")
                if live.get("latitude") is not None
                else (latest.get("latitude") if latest else None)
            ),
            "latest_longitude": (
                live.get("longitude")
                if live.get("longitude") is not None
                else (latest.get("longitude") if latest else None)
            ),
            "latest_speed": (
                live.get("speed")
                if live.get("latitude") is not None
                else (latest.get("speed") if latest else 0)
            ),
        },
    }
@frappe.whitelist()
def get_live_location(employee):
    if not employee:
        frappe.throw("Employee is required.")

    if not frappe.has_permission("Employee", ptype="read"):
        frappe.throw("You do not have permission to view Employee tracking.")

    employee_list = frappe.get_list(
        "Employee",
        filters={
            "name": employee,
            "custom_enable_live_tracking": 1
        },
        fields=["name", "employee_name"],
        limit_page_length=1
    )

    if not employee_list:
        frappe.throw("Employee not found or live tracking is disabled.")

    result = {
        "online": False,
        "status": "OFFLINE",
        "device_id": None,
        "latitude": None,
        "longitude": None,
        "speed": 0,
        "address": "",
        "time": None
    }

    try:
        session = requests.Session()

        # Login to Traccar
        login_response = session.post(
            TRACCAR_URL + "/api/session",
            data={
                "email": TRACCAR_EMAIL,
                "password": TRACCAR_PASSWORD
            },
            timeout=10
        )

        login_response.raise_for_status()

        # Find device using Employee ID
        device_response = session.get(
            TRACCAR_URL + "/api/devices",
            params={
                "uniqueId": employee
            },
            timeout=10
        )

        device_response.raise_for_status()

        devices = device_response.json()

        if not devices:
            return result

        device = devices[0]

        device_id = device.get("id")

        result["device_id"] = device_id

        # Device status
        device_status = (device.get("status") or "").lower()

        if device_status == "online":
            result["online"] = True
            result["status"] = "ONLINE"

        # Get latest Traccar position
        position_response = session.get(
            TRACCAR_URL + "/api/positions",
            params={
                "deviceId": device_id
            },
            timeout=10
        )

        position_response.raise_for_status()

        positions = position_response.json()

        if not positions:
            return result

        position = positions[0]

        latitude = position.get("latitude")
        longitude = position.get("longitude")

        if latitude is None or longitude is None:
            return result

        result["latitude"] = float(latitude)
        result["longitude"] = float(longitude)

        result["speed"] = round(
            float(position.get("speed") or 0),
            2
        )

        # Address
        address = position.get("address")

        if not address:
            try:
                geocode_response = session.get(
                    TRACCAR_URL + "/api/server/geocode",
                    params={
                        "latitude": latitude,
                        "longitude": longitude
                    },
                    timeout=10
                )

                if geocode_response.status_code == 200:
                    address = geocode_response.text.strip()

            except Exception:
                address = ""

        result["address"] = address or ""

        # Fix time
        fix_time = position.get("fixTime")

        if fix_time:
            fix_time = frappe.utils.get_datetime(fix_time)

            fix_time = frappe.utils.convert_utc_to_system_timezone(
                fix_time
            )

            result["time"] = fix_time.strftime(
                "%Y-%m-%d %H:%M:%S"
            )

        return result

    except Exception as e:

        frappe.log_error(
            "Employee: " + str(employee)
            + "\nLive Location Error: "
            + str(e),
            "Live Tracking Live Location Error"
        )

        return result

def live_tracking_cron():
    employees = frappe.get_all(
        "Employee",
        filters={
            "custom_enable_live_tracking": 1
        },
        fields=["name", "employee_name"]
    )

    for employee in employees:
        try:
            employee_id = employee.name

            session = requests.Session()

            # Traccar login
            login_response = session.post(
                TRACCAR_URL + "/api/session",
                data={
                    "email": TRACCAR_EMAIL,
                    "password": TRACCAR_PASSWORD
                },
                timeout=10
            )
            login_response.raise_for_status()

            # Find device
            device_response = session.get(
                TRACCAR_URL + "/api/devices",
                params={
                    "uniqueId": employee_id
                },
                timeout=10
            )
            device_response.raise_for_status()

            devices = device_response.json()

            if not devices:
                frappe.log_error(
                    "No Traccar device found for Employee: "
                    + employee_id,
                    "Live Tracking Cron"
                )
                continue

            device_id = devices[0].get("id")

            if not device_id:
                continue

            # Latest position
            position_response = session.get(
                TRACCAR_URL + "/api/positions",
                params={
                    "deviceId": device_id
                },
                timeout=10
            )
            position_response.raise_for_status()

            positions = position_response.json()

            if not positions:
                continue

            position = positions[0]

            latitude = position.get("latitude")
            longitude = position.get("longitude")
            speed = float(position.get("speed") or 0)

            if latitude is None or longitude is None:
                continue

            # Time
            fix_time = position.get("fixTime")

            if fix_time:
                fix_time = frappe.utils.get_datetime(fix_time)
                fix_time = frappe.utils.convert_utc_to_system_timezone(
                    fix_time
                )
                fix_time = fix_time.strftime("%Y-%m-%d %H:%M:%S")
            else:
                fix_time = frappe.utils.now()

            # Address
            address = position.get("address") or ""

            if not address:
                try:
                    geocode_response = session.get(
                        TRACCAR_URL + "/api/server/geocode",
                        params={
                            "latitude": latitude,
                            "longitude": longitude
                        },
                        timeout=10
                    )

                    if geocode_response.status_code == 200:
                        address = geocode_response.text.strip()

                except Exception:
                    address = ""

            # Distance
            attributes = position.get("attributes") or {}

            distance_km = round(
                float(attributes.get("distance") or 0) / 1000,
                3
            )

            total_distance_km = round(
                float(attributes.get("totalDistance") or 0) / 1000,
                3
            )

            # Snapshot time
            snapshot_time = frappe.utils.now_datetime()

            # Prevent duplicate snapshot if scheduler runs twice within a minute
            last_log = frappe.get_all(
                "Employee Location Log",
                filters={"employee": employee_id},
                fields=["name", "time"],
                order_by="time desc",
                limit_page_length=1
            )

            if last_log:
                last_time = frappe.utils.get_datetime(last_log[0].time)
                if (snapshot_time - last_time).total_seconds() < 60:
                    continue

            # Save location
            doc = frappe.get_doc({
                "doctype": "Employee Location Log",
                "employee": employee_id,
                "latitude": float(latitude),
                "longitude": float(longitude),
                "time": snapshot_time,
                "speed": speed,
                "address": address,
                "distance": distance_km,
                "total_distance": total_distance_km
            })

            doc.insert(ignore_permissions=True)

        except Exception:
            frappe.log_error(
                frappe.get_traceback(),
                "Live Tracking Cron Error"
            )

    frappe.db.commit()

@frappe.whitelist(allow_guest=True)
def gps_ingest():
    import requests

    params = dict(frappe.local.form_dict)
    params.pop("cmd", None)

    try:
        response = requests.get(
            "http://traccar:5055/",
            params=params,
            timeout=15
        )

        return {
            "status": "ok",
            "traccar_status": response.status_code,
            "message": response.text or "OK"
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "GPS Ingest Error")
        frappe.throw(str(e))

