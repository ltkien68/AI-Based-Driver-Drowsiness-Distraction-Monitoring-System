import json
import time
import paho.mqtt.client as mqtt
import os
from dotenv import load_dotenv

load_dotenv()

# Cau hinh MQTT
MQTT_BROKER = os.getenv("MQTT_BROKER", "127.0.0.1")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_CLIENT_ID = os.getenv(
    "MQTT_CLIENT_ID",
    "ksafe_python_ai"
)

MQTT_USERNAME = os.getenv("MQTT_USERNAME")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")

# Cac topic MQTT
TOPIC_STATE = "ksafe/driver/state"
TOPIC_METRICS = "ksafe/driver/metrics"
TOPIC_RESET = "ksafe/device/reset"
TOPIC_CONNECTION = "ksafe/system/connection"
TOPIC_HEARTBEAT = "ksafe/system/heartbeat"


class KSafeMQTTClient:

    def __init__(self):
        self.client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id=MQTT_CLIENT_ID
        )

        self.da_ket_noi = False

        # Neu Python mat ket noi bat ngo, Broker se gui trang thai OFFLINE
        self.client.will_set(
            TOPIC_CONNECTION,
            payload="OFFLINE",
            qos=1,
            retain=True
        )

        # Cau hinh thoi gian cho phep thu ket noi lai
        self.client.reconnect_delay_set(
            min_delay=1,
            max_delay=30
        )

        # Dang ky callback
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        self.client.on_message = self.on_message
        self.client.on_publish = self.on_publish

    # Xu ly khi ket noi Broker
    def on_connect(self, client, userdata, flags, reason_code, properties):
        if reason_code == 0:
            self.da_ket_noi = True
            print("[MQTT] Ket noi Broker thanh cong!")

            # Dang ky nhan lenh reset
            client.subscribe(TOPIC_RESET, qos=1)
            print(f"[MQTT] Subscribe: {TOPIC_RESET}")

            # Thong bao Python AI dang ONLINE
            self._publish(
                TOPIC_CONNECTION,
                "ONLINE",
                retain=True
            )

        else:
            self.da_ket_noi = False
            print(f"[MQTT] Ket noi that bai: {reason_code}")

    # Xu ly khi mat ket noi
    def on_disconnect(
        self,
        client,
        userdata,
        disconnect_flags,
        reason_code,
        properties
    ):
        self.da_ket_noi = False
        print(f"[MQTT] Mat ket noi Broker: {reason_code}")

    # Xu ly message nhan duoc
    def on_message(self, client, userdata, message):
        try:
            payload = message.payload.decode("utf-8")
            print(
                f"[MQTT] Nhan lenh: "
                f"{message.topic} -> {payload}"
            )

            # Hien tai chi ghi nhan lenh reset.
            # Chua thuc hien reset AI tai day.

        except Exception as e:
            print(f"[MQTT] Loi xu ly message: {e}")

    # Xac nhan message da duoc Broker phan hoi
    def on_publish(
        self,
        client,
        userdata,
        mid,
        reason_code,
        properties
    ):
        if reason_code == 0:
            print(f"[MQTT] Message {mid} da duoc Broker xac nhan!")

    # Ket noi Broker
    def connect(self):
        try:
            print("[MQTT] Dang ket noi Broker...")

            self.client.username_pw_set(
                MQTT_USERNAME,
                MQTT_PASSWORD
            )

            # Ket noi bat dong bo, cho phep tu thu lai
            self.client.connect_async(
                MQTT_BROKER,
                MQTT_PORT,
                keepalive=60
            )

            # Chay MQTT network loop tren thread rieng
            self.client.loop_start()

        except Exception as e:
            print(f"[MQTT] Loi khoi dong ket noi: {e}")

    # Gui trang thai tai xe
    def publish_state(self, state):
        self._publish(TOPIC_STATE, state)

    # Gui chi so AI
    def publish_metrics(self, ear, head_pose, eye_direction):
        data = {
            "ear": ear,
            "head_pose": head_pose,
            "eye_direction": eye_direction,
            "timestamp": int(time.time())
        }

        self._publish(TOPIC_METRICS, data)

    # Gui heartbeat bao hieu AI con hoat dong
    def publish_heartbeat(self):
        data = {
            "status": "ALIVE",
            "timestamp": int(time.time())
        }

        self._publish(TOPIC_HEARTBEAT, data)

    # Publish message
    def _publish(self, topic, data, retain=False):
        if not self.client.is_connected():
            print("[MQTT] Chua ket noi, bo qua message!")
            return

        try:
            if isinstance(data, dict):
                payload = json.dumps(
                    data,
                    ensure_ascii=False
                )
            else:
                payload = str(data)

            result = self.client.publish(
                topic,
                payload,
                qos=1,
                retain=retain
            )

            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                print(
                    f"[MQTT] Da dua message vao hang doi: "
                    f"{topic} -> {payload}"
                )
            else:
                print(
                    f"[MQTT] Publish that bai: {result.rc}"
                )

        except Exception as e:
            print(f"[MQTT] Loi publish: {e}")

    # Ngat ket noi an toan
    def disconnect(self):
        if self.client.is_connected():
            # Thong bao OFFLINE truoc khi ngat ket noi
            result = self.client.publish(
                TOPIC_CONNECTION,
                "OFFLINE",
                qos=1,
                retain=True
            )

            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                try:
                    result.wait_for_publish(timeout=2)
                except Exception:
                    pass

            self.client.disconnect()

        self.client.loop_stop()
        self.da_ket_noi = False

        print("[MQTT] Da ngat ket noi!")
