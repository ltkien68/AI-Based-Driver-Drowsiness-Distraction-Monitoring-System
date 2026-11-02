import serial
import time

COM_PORT = "COM3" 
BAUD_RATE = 115200

esp32 = serial.Serial(
    COM_PORT,
    BAUD_RATE,
    timeout=0.1
)

print("Da ket noi ESP32")
print("Nhan button de test...")

while True:
    if esp32.in_waiting > 0:
        tin_hieu = esp32.readline().decode().strip()

        if tin_hieu:
            print(f"ESP32: {tin_hieu}")

    time.sleep(0.01)