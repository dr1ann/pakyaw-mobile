package expo.modules.pip

import android.app.PictureInPictureParams
import android.content.pm.PackageManager
import android.os.Build
import android.util.Rational
import androidx.core.os.bundleOf
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class PipAspectRatioRecord : Record {
  @Field
  var num: Int = 16

  @Field
  var den: Int = 9
}

class PipEnterOptionsRecord : Record {
  @Field
  var aspectRatio: PipAspectRatioRecord? = null
}

class ExpoPipModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoPip")

    Events("onPipModeChanged")

    Function("isSupported") {
      isPictureInPictureSupported()
    }

    Function("isActive") {
      appContext.currentActivity?.isInPictureInPictureMode == true
    }

    Function("emitCurrentState") {
      emitCurrentState()
    }

    AsyncFunction("enter") { options: PipEnterOptionsRecord ->
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      if (!isPictureInPictureSupported() || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        emitCurrentState()
        return@AsyncFunction false
      }

      val aspectRatio = options.aspectRatio
      val numerator = (aspectRatio?.num ?: 16).coerceAtLeast(1)
      val denominator = (aspectRatio?.den ?: 9).coerceAtLeast(1)
      val params = PictureInPictureParams.Builder()
        .setAspectRatio(Rational(numerator, denominator))
        .build()
      val entered = activity.enterPictureInPictureMode(params)
      emitCurrentState()
      entered
    }

    OnActivityEntersForeground {
      emitCurrentState()
    }

    OnActivityEntersBackground {
      emitCurrentState()
    }
  }

  private fun isPictureInPictureSupported(): Boolean {
    val activity = appContext.currentActivity ?: return false
    return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
      activity.packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)
  }

  private fun emitCurrentState() {
    sendEvent(
      "onPipModeChanged",
      bundleOf(
        "isInPip" to (appContext.currentActivity?.isInPictureInPictureMode == true),
        "isSupported" to isPictureInPictureSupported()
      )
    )
  }
}
