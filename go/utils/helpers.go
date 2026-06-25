package util

import "strconv"

func SayHi(message string) string {
	return "Hi, " + message
}

func SayHello(message string) string {
	return "Hello, " + message
}

func ParsePrice(s string) (float64, error) {
	f, err := strconv.ParseFloat(s, 64)

	if err != nil {
		return 0, err
	}

	return f, nil
}

func ParseQuantity(s string) (int, error) {
	i, err := strconv.Atoi(s)

	if err != nil {
		return 0, err
	}

	return i, nil
}
