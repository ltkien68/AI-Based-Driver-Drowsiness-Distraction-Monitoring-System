import json
import time
import paho.mqtt.client as mqtt


# Cau hinh MQTT
MQTT_BROKER = "127.0.0.1"
MQTT_PORT = 1883
MQTT_CLIENT_ID = "ksafe_python_ai"

TOPIC_STATE = "ksafe/driver/state"
TOPIC_METRICS = "ksafe/driver/metrics"
TOPIC_RESET = "ksafe/device/reset"


class KSafeMQTTClient:

    def __init__(self):
        self.client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id=MQTT_CLIENT_ID
        )

        self.da_ket_noi = False

        # Dang ky callback
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        self.client.on_message = self.on_message

    # Xu ly khi ket noi Broker
    def on_connect(self, client, userdata, flags, reason_code, properties):
        if reason_code == 0:
            self.da_ket_noi = True
            print("[MQTT] Ket noi Broker thanh cong!")

            # Dang ky nhan lenh reset
            client.subscribe(TOPIC_RESET, qos=1)
            print(f"[MQTT] Subscribe: {TOPIC_RESET}")
        else:
            self.da_ket_noi = False
            print(f"[MQTT] Ket noi that bai: {reason_code}")

    # Xu ly khi mat ket noi
    def on_disconnect(self, client, userdata, disconnect_flags, reason_code, properties):
        self.da_ket_noi = False
        print("[MQTT] Mat ket noi Broker!")

    # Xu ly message nhan duoc
    def on_message(self, client, userdata, message):
        try:
            payload = message.payload.decode("utf-8")
            print(f"[MQTT] Nhan lenh: {message.topic} -> {payload}")

        except Exception as e:
            print(f"[MQTT] Loi xu ly message: {e}")

    # Ket noi Broker
    def connect(self):
        try:
            self.client.connect(
                MQTT_BROKER,
                MQTT_PORT,
                keepalive=60
            )

            # Chay MQTT network loop tren thread rieng
            self.client.loop_start()

        except Exception as e:
            print(f"[MQTT] Khong the ket noi: {e}")

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

    # Publish message
    def _publish(self, topic, data):
        if not self.da_ket_noi:
            print("[MQTT] Chua ket noi, bo qua message!")
            return

        try:
            if isinstance(data, dict):
                payload = json.dumps(data, ensure_ascii=False)
            else:
                payload = str(data)

            result = self.client.publish(
                topic,
                payload,
                qos=1
            )

            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                print(f"[MQTT] Publish: {topic} -> {payload}")
            else:
                print(f"[MQTT] Publish that bai: {result.rc}")

        except Exception as e:
            print(f"[MQTT] Loi publish: {e}")

    # Ngat ket noi
    def disconnect(self):
        self.client.loop_stop()
        self.client.disconnect()
        self.da_ket_noi = False
        print("[MQTT] Da ngat ket noi!")
