import time
from mqtt_client import KSafeMQTTClient


mqtt_client = KSafeMQTTClient()

# Ket noi MQTT Broker
mqtt_client.connect()

try:
    time.sleep(2)

    # Gia lap trang thai tai xe
    mqtt_client.publish_state("SAFE")

    time.sleep(1)

    mqtt_client.publish_metrics(
        ear=0.28,
        head_pose="STRAIGHT",
        eye_direction="CENTER"
    )

    time.sleep(1)

    mqtt_client.publish_state("WARNING")

    # Duy tri ket noi de nhan message
    while True:
        time.sleep(1)

except KeyboardInterrupt:
    print("\nDung chuong trinh!")

finally:
    mqtt_client.disconnect()
