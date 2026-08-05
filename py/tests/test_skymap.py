from collective_sky.skymap import fnv1a, sky_position

def test_fnv1a_matches_the_reference_implementation():
    assert fnv1a("11111111111111111111111111111111") == 551368101
    assert fnv1a("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d") == 913874821
    assert fnv1a("StellaMintDemoAsset1111111111111111111111111") == 2175836036

def test_sky_position_matches_stellamint():
    assert sky_position("11111111111111111111111111111111") == (10.1, 44.5)
    assert sky_position("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d") == (82.1, 45.5)
    assert sky_position("StellaMintDemoAsset1111111111111111111111111") == (3.6, 83.9)

def test_positions_stay_inside_the_canvas():
    for i in range(200):
        x, y = sky_position(f"asset-{i}")
        assert 0.0 <= x < 100.0
        assert 0.0 <= y < 100.0

def test_position_is_stable_for_the_same_id():
    assert sky_position("abc") == sky_position("abc")
