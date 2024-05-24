#!/bin/sh

courses=$(realpath $1)

medians=$(mktemp)
names=$(mktemp)

trap "rm -f $medians" EXIT
trap "rm -f $names" EXIT


# get medians
while IFS= read -r course_code ; do
  url="https://michael-maltsev.github.io/technion-histograms/$course_code/index.min.json"
  result=$(curl -s "$url" | jq '[.. | objects | select(has("median")) | .median | tonumber ] | .[-5:] | add / length')
  if [ $? -eq 0 ]; then
    echo "$result"
  else
    echo "error"
  fi
done < $courses > $medians

# get names
while IFS= read -r course_code ; do
  curl -s https://students.technion.ac.il/local/technionsearch/course/$course_code | grep https://students.technion.ac.il/local/technionsearch/course/$course_coude | grep aria-current | sed -n 's/.*<a[^>]*>\(.*\)<\/a>.*/\1/p'
done < $courses > $names


paste $courses $medians $names | sort -k2,2n | tac
