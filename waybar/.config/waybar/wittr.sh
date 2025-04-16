#!/usr/bin/sh
req=$(curl -s https://ja.wttr.in/Osaka?format="%t|%l+(%c%f)+%h,+%C")
bar=$(echo "$req" | awk -F "|" '{print $1}')
tooltip=$(echo "$req" | awk -F "|" '{print $2}')
echo "{\"text\":\"$bar\", \"tooltip\":\"$tooltip\"}"
